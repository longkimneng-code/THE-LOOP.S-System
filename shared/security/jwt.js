// ============================================================================
// THE LOOPS UNIVERSAL RETAIL SUITE — RFC 7519 & RFC 8725 JWT SECURITY ENGINE
// Zero-dependency cryptographic JWT implementation with strict algorithm allowlists,
// constant-time verification, and claim validation.
// ============================================================================

const crypto = require('crypto');

const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'theloops_enterprise_jwt_super_secret_signing_key_2026_change_in_prod';
if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change_in_prod'))) {
  console.warn('\x1b[31m[CRITICAL SECURITY WARNING] JWT_SECRET is unset or using default fallback in production mode. Set JWT_SECRET in environment.\x1b[0m');
}
const DEFAULT_ISSUER = 'https://auth.theloops.io';
const DEFAULT_AUDIENCE = 'theloops-api';
const ALLOWED_ALGORITHMS = ['HS256'];

/**
 * Base64URL Encoding without padding per RFC 7515
 */
function base64UrlEncode(data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data), 'utf8');
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * Base64URL Decoding to string or Buffer
 */
function base64UrlDecode(str, asBuffer = false) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const buf = Buffer.from(base64, 'base64');
  return asBuffer ? buf : buf.toString('utf8');
}

/**
 * Sign a payload and return a compact JWT string
 */
function signToken(payload, options = {}) {
  const secret = options.secret || DEFAULT_JWT_SECRET;
  const expiresInSeconds = options.expiresInSeconds || 30 * 24 * 3600; // 30 days default durable POS session
  const issuer = options.issuer || DEFAULT_ISSUER;
  const audience = options.audience || DEFAULT_AUDIENCE;

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    ...payload,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + expiresInSeconds,
    jti: payload.jti || crypto.randomUUID()
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(claims);
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signatureInput);
  const signature = base64UrlEncode(hmac.digest());

  return `${signatureInput}.${signature}`;
}

/**
 * Verify a JWT string with strict security controls per RFC 8725
 */
function verifyToken(token, options = {}) {
  if (!token || typeof token !== 'string') {
    throw new Error('Token is missing or not a string');
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format: expected 3 dot-separated segments');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // 1. Parse and validate header
  let header;
  try {
    header = JSON.parse(base64UrlDecode(encodedHeader));
  } catch (e) {
    throw new Error('Malformed JWT header');
  }

  const allowedAlgs = options.allowedAlgorithms || ALLOWED_ALGORITHMS;
  if (!header.alg || !allowedAlgs.includes(header.alg)) {
    throw new Error(`Security Exception: Algorithm '${header.alg}' is not in the allowed algorithms list`);
  }

  // 2. Cryptographic signature check (constant-time comparison)
  const secret = options.secret || DEFAULT_JWT_SECRET;
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signatureInput);
  const expectedSignatureBuffer = hmac.digest();
  const providedSignatureBuffer = base64UrlDecode(encodedSignature, true);

  if (expectedSignatureBuffer.length !== providedSignatureBuffer.length ||
      !crypto.timingSafeEqual(expectedSignatureBuffer, providedSignatureBuffer)) {
    throw new Error('Invalid token signature');
  }

  // 3. Parse and validate claims
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (e) {
    throw new Error('Malformed JWT payload');
  }

  const now = Math.floor(Date.now() / 1000);
  const clockTolerance = options.clockToleranceSeconds || 10;

  // Check expiry
  if (typeof payload.exp === 'number' && (now - clockTolerance) >= payload.exp) {
    const err = new Error('Token has expired');
    err.name = 'TokenExpiredError';
    err.expiredAt = new Date(payload.exp * 1000).toISOString();
    throw err;
  }

  // Check Not-Before
  if (typeof payload.nbf === 'number' && (now + clockTolerance) < payload.nbf) {
    throw new Error('Token is not active yet (nbf claim)');
  }

  // Check Issuer
  const expectedIssuer = options.issuer || DEFAULT_ISSUER;
  if (expectedIssuer && payload.iss !== expectedIssuer) {
    throw new Error(`Invalid token issuer: expected '${expectedIssuer}', got '${payload.iss}'`);
  }

  // Check Audience
  const expectedAudience = options.audience || DEFAULT_AUDIENCE;
  if (expectedAudience) {
    const audArray = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audArray.includes(expectedAudience)) {
      throw new Error(`Invalid token audience: expected '${expectedAudience}'`);
    }
  }

  return payload;
}

/**
 * Decode token without verification (for debugging/inspection only)
 */
function decodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length < 2) return null;
  try {
    return {
      header: JSON.parse(base64UrlDecode(parts[0])),
      payload: JSON.parse(base64UrlDecode(parts[1]))
    };
  } catch (e) {
    return null;
  }
}

module.exports = {
  signToken,
  verifyToken,
  decodeToken,
  DEFAULT_ISSUER,
  DEFAULT_AUDIENCE
};

