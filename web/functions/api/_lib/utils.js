const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function base64UrlEncode(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacSha256(secret, content) {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(content));
  return new Uint8Array(signature);
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function getBearerToken(request) {
  const header = request.headers.get('authorization') || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7).trim();
}

export async function hashPassword(password, secret) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    textEncoder.encode(`${password}:${secret}`)
  );

  return base64UrlEncode(new Uint8Array(digest));
}

export async function sha256Hex(content) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(content));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function createToken(payload, secret) {
  const header = base64UrlEncode(textEncoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64UrlEncode(
    textEncoder.encode(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
      })
    )
  );

  const unsignedToken = `${header}.${body}`;
  const signature = base64UrlEncode(await hmacSha256(secret, unsignedToken));

  return `${unsignedToken}.${signature}`;
}

export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const unsignedToken = `${header}.${body}`;
  const expectedSignature = base64UrlEncode(await hmacSha256(secret, unsignedToken));

  if (expectedSignature !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(textDecoder.decode(base64UrlDecode(body)));
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function calculateWeight(content) {
  let weight = 1;
  weight += Math.min(content.length / 100, 1);

  const hour = new Date().getHours();
  if (hour >= 23 || hour < 5) {
    weight += 0.5;
  }

  return weight * 10;
}
