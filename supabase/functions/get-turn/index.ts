const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const username   = Deno.env.get('METERED_TURN_USERNAME')   || '';
  const credential = Deno.env.get('METERED_TURN_CREDENTIAL') || '';

  const stun = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turn = username && credential ? [
    { urls: 'turn:global.relay.metered.ca:80',                  username, credential },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp',    username, credential },
    { urls: 'turn:global.relay.metered.ca:443',                 username, credential },
    { urls: 'turn:global.relay.metered.ca:443?transport=tcp',   username, credential },
    { urls: 'turns:global.relay.metered.ca:443',                username, credential },
  ] : [
    // Public fallback — always available even without credentials configured
    { urls: 'turn:openrelay.metered.ca:80',                username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',               username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turns:openrelay.metered.ca:443',              username: 'openrelayproject', credential: 'openrelayproject' },
  ];

  const iceServers = [...stun, ...turn];

  return new Response(JSON.stringify({ iceServers }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
