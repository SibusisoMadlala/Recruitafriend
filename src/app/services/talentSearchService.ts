type TalentSearchServiceOptions = {
  serverUrl: string;
  endpoint: string;
  token?: string;
  publicAnonKey: string;
  requestOptions?: RequestInit;
};

function isLikelyJwt(token: string | undefined | null) {
  if (!token) return false;
  const parts = token.split('.');
  const jwtPart = /^[A-Za-z0-9_=-]+$/;
  return parts.length === 3 && parts.every((p) => p.length > 0 && jwtPart.test(p));
}

function decodeJwtHeader(token: string) {
  try {
    const [headerPart] = token.split('.');
    if (!headerPart) return null;
    const base64 = headerPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binString = atob(padded);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as { alg?: string; typ?: string };
  } catch {
    return null;
  }
}

export async function requestTalentSearchFromService({
  serverUrl,
  endpoint,
  token,
  publicAnonKey,
  requestOptions,
}: TalentSearchServiceOptions) {
  const hasUserJwt = isLikelyJwt(token);
  const jwtAlg = hasUserJwt ? String(decodeJwtHeader(String(token))?.alg || '').toUpperCase() : '';
  const shouldBypassGatewayJwtValidation = jwtAlg === 'ES256';

  const baseHeaders = new Headers(requestOptions?.headers || {});
  baseHeaders.set('Content-Type', 'application/json');
  baseHeaders.set('apikey', publicAnonKey);

  const authorizationToken = shouldBypassGatewayJwtValidation
    ? publicAnonKey
    : (hasUserJwt ? String(token) : publicAnonKey);
  baseHeaders.set('Authorization', `Bearer ${authorizationToken}`);

  if (shouldBypassGatewayJwtValidation && hasUserJwt) {
    baseHeaders.set('x-rf-user-jwt', String(token));
  }

  return fetch(`${serverUrl}${endpoint}`, {
    ...(requestOptions || {}),
    headers: baseHeaders,
  });
}