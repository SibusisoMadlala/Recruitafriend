import { createClient } from 'npm:@supabase/supabase-js@2';

// ── env ────────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')  || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT     = 'mailto:admin@recruitfriend.co.za';

// ── base64url helpers ──────────────────────────────────────────────────
function b64uToBytes(s: string): Uint8Array {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad), c => c.charCodeAt(0));
}
function bytesToB64u(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ── Import VAPID signing key from raw scalar + public point ────────────
async function importVapidKey(): Promise<CryptoKey> {
  const pub = b64uToBytes(VAPID_PUBLIC_KEY); // 65 bytes: 0x04 || x[32] || y[32]
  const x = bytesToB64u(pub.slice(1, 33));
  const y = bytesToB64u(pub.slice(33, 65));
  const d = VAPID_PRIVATE_KEY;
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, key_ops: ['sign'] },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

// ── Build VAPID Authorization header ──────────────────────────────────
async function vapidHeader(audience: string): Promise<string> {
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 43200, sub: VAPID_SUBJECT };
  const enc     = (o: unknown) => bytesToB64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const key  = await importVapidKey();
  const sig  = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  const jwt  = `${unsigned}.${bytesToB64u(sig)}`;
  return `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`;
}

// ── Web Push payload encryption (RFC 8291 / aesgcm128) ────────────────
async function encrypt(
  plaintext: string,
  p256dhB64: string,
  authB64: string,
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const salt      = crypto.getRandomValues(new Uint8Array(16));
  const authSecret = b64uToBytes(authB64);
  const receiverKey = await crypto.subtle.importKey(
    'raw', b64uToBytes(p256dhB64),
    { name: 'ECDH', namedCurve: 'P-256' }, true, [],
  );

  // Ephemeral server key pair
  const serverECDH = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverECDH.publicKey));

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey }, serverECDH.privateKey, 256);

  // HKDF auth → auth-info PRK
  const hkdfKey = (material: ArrayBuffer, salt: ArrayBuffer) =>
    crypto.subtle.importKey('raw', material, { name: 'HKDF' }, false, ['deriveBits', 'deriveKey']);
  const derive  = (key: CryptoKey, salt: ArrayBuffer, info: Uint8Array, len: number) =>
    crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len);

  const authInfo   = new TextEncoder().encode('Content-Encoding: auth\0');
  const prk        = await hkdfKey(sharedBits, authSecret);
  const prkExpanded = await derive(prk, authSecret, authInfo, 256);

  // Context = receiver pub key + server pub key
  const receiverRaw  = new Uint8Array(await crypto.subtle.exportKey('raw', receiverKey));
  const context      = new Uint8Array(135);
  context.set([0, 65], 0);
  context.set(receiverRaw, 2);
  context.set([0, 65], 67);
  context.set(serverPubRaw, 69);

  const cekInfo   = concat(new TextEncoder().encode('Content-Encoding: aesgcm\0'), context);
  const nonceInfo = concat(new TextEncoder().encode('Content-Encoding: nonce\0'), context);

  const contentKey = await hkdfKey(prkExpanded, salt);
  const cekBits    = await derive(contentKey, salt, cekInfo, 128);
  const nonceBits  = await derive(contentKey, salt, nonceInfo, 96);

  const aesKey = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']);
  const nonce  = new Uint8Array(nonceBits);

  // Pad plaintext: 2 bytes padding length (0) + plaintext
  const ptBytes = new TextEncoder().encode(plaintext);
  const padded  = new Uint8Array(2 + ptBytes.length);
  padded.set(ptBytes, 2);

  const ciphered = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded);
  return { ciphertext: new Uint8Array(ciphered), salt, serverPublicKey: serverPubRaw };
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out   = new Uint8Array(total);
  let offset  = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

// ── Send one notification ──────────────────────────────────────────────
async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string) {
  const { ciphertext, salt, serverPublicKey } = await encrypt(payload, sub.p256dh, sub.auth);
  const url      = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const auth     = await vapidHeader(audience);

  const res = await fetch(sub.endpoint, {
    method:  'POST',
    headers: {
      Authorization:    auth,
      'Content-Type':   'application/octet-stream',
      'Content-Length': String(ciphertext.length),
      'Content-Encoding': 'aesgcm',
      Encryption:       `salt=${bytesToB64u(salt)}`,
      'Crypto-Key':     `dh=${bytesToB64u(serverPublicKey)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
      TTL:              '86400',
    },
    body: ciphertext,
  });

  if (!res.ok && res.status !== 201) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Push failed ${res.status}: ${txt}`);
  }
}

// ── Edge Function handler ──────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const { seeker_id, title, body, url, tag } = await req.json();
    if (!seeker_id) return new Response(JSON.stringify({ error: 'seeker_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: sub } = await db.from('push_subscriptions').select('endpoint,p256dh,auth').eq('user_id', seeker_id).maybeSingle();

    if (!sub) return new Response(JSON.stringify({ sent: false, reason: 'no_subscription' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    await sendPush(sub, JSON.stringify({ title, body, url: url || '/interviews', tag: tag || 'interview' }));

    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('send-push error', err);
    return new Response(JSON.stringify({ sent: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
