const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const username   = Deno.env.get('METERED_TURN_USERNAME')   || '';
  const credential = Deno.env.get('METERED_TURN_CREDENTIAL') || '';

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.relay.metered.ca:80' },
    { urls: 'turn:global.relay.metered.ca:80',                  username, credential },
    { urls: 'turn:global.relay.metered.ca:80?transport=tcp',    username, credential },
    { urls: 'turn:global.relay.metered.ca:443',                 username, credential },
    { urls: 'turn:global.relay.metered.ca:443?transport=tcp',   username, credential },
    { urls: 'turns:global.relay.metered.ca:443',                username, credential },
  ];

  return new Response(JSON.stringify({ iceServers }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
});
