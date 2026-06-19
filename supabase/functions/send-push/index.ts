import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT     = 'mailto:admin@recruitfriend.co.za';

// ── helpers ─────────────────────────────────────────────────────────────
function b64uToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0));
}
function bytesToB64u(buf: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

// ── VAPID JWT ────────────────────────────────────────────────────────────
async function importVapidKey(): Promise<CryptoKey> {
  const pub = b64uToBytes(VAPID_PUBLIC_KEY);
  const x = bytesToB64u(pub.slice(1, 33));
  const y = bytesToB64u(pub.slice(33, 65));
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d: VAPID_PRIVATE_KEY, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );
}

async function vapidHeader(audience: string): Promise<string> {
  const enc = (o: unknown) => bytesToB64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: VAPID_SUBJECT })}`;
  const key = await importVapidKey();
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return `vapid t=${unsigned}.${bytesToB64u(sig)},k=${VAPID_PUBLIC_KEY}`;
}

// ── aes128gcm encryption (RFC 8188 + RFC 8291) ───────────────────────────
async function encrypt(plaintext: string, p256dhB64: string, authB64: string): Promise<Uint8Array> {
  const salt       = crypto.getRandomValues(new Uint8Array(16));
  const authSecret = b64uToBytes(authB64);

  const receiverPubKey = await crypto.subtle.importKey(
    'raw', b64uToBytes(p256dhB64), { name: 'ECDH', namedCurve: 'P-256' }, true, [],
  );
  const serverPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubRaw  = new Uint8Array(await crypto.subtle.exportKey('raw', serverPair.publicKey));
  const receiverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', receiverPubKey));

  // ECDH → IKM via RFC 8291 WebPush info
  const ecdhSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverPubKey }, serverPair.privateKey, 256);
  const prkKey = await crypto.subtle.importKey('raw', ecdhSecret, { name: 'HKDF' }, false, ['deriveBits']);
  const webPushInfo = concat(new TextEncoder().encode('WebPush: info\x00'), receiverPubRaw, serverPubRaw);
  const ikm = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: webPushInfo },
    prkKey, 256,
  );

  // RFC 8188 key derivation from IKM + random salt
  const prk2 = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const cekBits   = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: aes128gcm\x00') }, prk2, 128);
  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode('Content-Encoding: nonce\x00') }, prk2, 96);

  const aesKey = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']);

  // Pad: plaintext + 0x02 delimiter (single-record, no extra padding)
  const pt = new TextEncoder().encode(plaintext);
  const padded = new Uint8Array(pt.length + 1);
  padded.set(pt);
  padded[pt.length] = 0x02;

  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(nonceBits) }, aesKey, padded));

  // Build RFC 8188 content: salt(16) || rs(4,BE) || idlen(1) || server_pub(65) || ciphertext
  const body = new Uint8Array(16 + 4 + 1 + 65 + ciphertext.length);
  let off = 0;
  body.set(salt, off); off += 16;
  new DataView(body.buffer).setUint32(off, 4096, false); off += 4;
  body[off] = 65; off += 1;
  body.set(serverPubRaw, off); off += 65;
  body.set(ciphertext, off);
  return body;
}

// ── send one notification ────────────────────────────────────────────────
async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const body = await encrypt(payload, sub.p256dh, sub.auth);
  const url  = new URL(sub.endpoint);
  const auth = await vapidHeader(`${url.protocol}//${url.host}`);

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization:      auth,
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL:                '86400',
      Urgency:            'high',
    },
    body,
  });

  if (!res.ok && res.status !== 201) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Push failed ${res.status}: ${txt}`);
  }
}

// ── Edge Function handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: cors });

  try {
    const { seeker_id, title, body, url, tag } = await req.json();
    if (!seeker_id) return new Response(JSON.stringify({ error: 'seeker_id required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: sub } = await db.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', seeker_id).maybeSingle();

    if (!sub) return new Response(JSON.stringify({ sent: false, reason: 'no_subscription' }), { headers: { ...cors, 'Content-Type': 'application/json' } });

    await sendPush(sub, JSON.stringify({ title, body, url: url || '/seeker/interviews', tag: tag || 'interview' }));

    // Store in notifications inbox (best-effort)
    await db.from('notifications').insert({ user_id: seeker_id, title, body, url: url || '/seeker/interviews', tag: tag || 'interview' }).catch(() => {});

    return new Response(JSON.stringify({ sent: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('send-push error', err);
    return new Response(JSON.stringify({ sent: false, error: String(err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
