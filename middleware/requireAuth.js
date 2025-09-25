// middleware/requireAuth.js — v3.2 (verbose + JWKS auto-refresh + issuer strict)
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');

// fetch polyfill for Node < 18
const _fetch = (typeof fetch === 'function')
  ? fetch
  : (...args) => import('node-fetch').then(m => m.default(...args));

// ----- version banner (便于确认加载的是这份文件) -----
const VERSION = 'requireAuth v3.2';
console.log(`[${VERSION}] loaded`);

const REGION = process.env.AWS_REGION;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const EXPECTED_ISSUER = (REGION && USER_POOL_ID)
  ? `https://cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`
  : null;

// issuer -> { data:{keys:[]}, ts:number }
const jwksCache = new Map();
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h

async function fetchJwks(issuer) {
  const url = `${issuer}/.well-known/jwks.json`;
  const res = await _fetch(url);
  if (!res.ok) throw new Error(`JWKS HTTP ${res.status} from ${url}`);
  return res.json();
}
async function getCachedJwks(issuer) {
  const now = Date.now();
  const hit = jwksCache.get(issuer);
  if (hit && (now - hit.ts) < JWKS_TTL_MS) return hit.data;
  const data = await fetchJwks(issuer);
  jwksCache.set(issuer, { data, ts: now });
  return data;
}

function reply(res, http, code, message, extra = {}) {
  return res.status(http).json({ error: message, code, ...extra, _v: VERSION });
}

function verifyWithJwk(token, jwk) {
  const pem = jwkToPem(jwk);
  return jwt.verify(token, pem, { algorithms: ['RS256'], clockTolerance: 30 });
}

module.exports = async function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return reply(res, 401, 'NO_TOKEN', 'Missing token');

    const token = m[1];
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.header?.kid || !decoded?.payload) {
      return reply(res, 401, 'BAD_TOKEN', 'Invalid token: cannot decode header/payload');
    }
    const { header, payload } = decoded;

    // 可观测日志（每次都会打印）
    console.log(`[${VERSION}] check`,
      'path=', req.path,
      'kid=', header.kid,
      'iss=', payload.iss,
      'aud=', payload.aud,
      'exp=', payload.exp,
      'use=', payload.token_use
    );

    // issuer 必须存在且形状正确
    const tokenIssuer = payload.iss;
    if (!tokenIssuer) return reply(res, 401, 'NO_ISS', 'Token has no issuer (iss)');
    const okIssuer = /^https:\/\/cognito-idp\.[-.a-z0-9]+\.amazonaws\.com\/[A-Za-z0-9_-]+$/.test(tokenIssuer);
    if (!okIssuer) return reply(res, 401, 'BAD_ISS', 'Token issuer is not a valid Cognito issuer', { got: tokenIssuer });

    // 与 .env 严格匹配（防跨池）
    if (EXPECTED_ISSUER && tokenIssuer !== EXPECTED_ISSUER) {
      return reply(res, 401, 'ISS_MISMATCH', 'Issuer mismatch', { expected: EXPECTED_ISSUER, got: tokenIssuer });
    }

    // 找 kid 对应公钥；miss 时强制刷新一次 JWKS
    let { keys } = await getCachedJwks(tokenIssuer);
    let jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) {
      console.warn(`[${VERSION}] kid miss in cache, refreshing JWKS… kid=`, header.kid);
      const fresh = await fetchJwks(tokenIssuer);
      jwksCache.set(tokenIssuer, { data: fresh, ts: Date.now() });
      jwk = fresh.keys.find(k => k.kid === header.kid);
      if (!jwk) return reply(res, 401, 'UNKNOWN_KID', 'No matching JWK kid for token', { kid: header.kid });
    }

    const verified = verifyWithJwk(token, jwk);

    // 限定 token_use
    if (verified.token_use !== 'id' && verified.token_use !== 'access') {
      return reply(res, 401, 'BAD_USE', 'Unsupported token_use', { token_use: verified.token_use });
    }

    // 可选：aud 校验
    if (process.env.COGNITO_CLIENT_ID && verified.aud && verified.aud !== process.env.COGNITO_CLIENT_ID) {
      return reply(res, 401, 'AUD_MISMATCH', 'Audience mismatch', {
        expected: process.env.COGNITO_CLIENT_ID, got: verified.aud
      });
    }

    req.user = verified;
    next();
  } catch (e) {
    console.error(`[${VERSION}] error`, e?.message || e);
    return reply(res, 401, 'VERIFY_FAIL', 'Invalid/expired token', { detail: String(e?.message || e) });
  }
};
