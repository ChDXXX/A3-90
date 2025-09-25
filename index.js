// index.js — final wiring for A1 + A2 (with debug & auth header logging)
require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* -------------------- Security headers -------------------- */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],            // 允许同源外链脚本
      "script-src-attr": ["'none'"],       // 禁止内联事件（前端已移除 onclick）
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https:"], // 允许同源 fetch
      "style-src": ["'self'", "https:", "'unsafe-inline'"]
    }
  },
  hsts: { maxAge: 60 * 60 * 24 * 180, includeSubDomains: true }
}));

/* -------------------- Logs, parsers, static -------------------- */
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

// === Authorization header logger (put BEFORE routers) ===
app.use((req, _res, next) => {
  const h = req.headers.authorization || '(none)';
  console.log('[AUTH]', req.method, req.url, h.startsWith('Bearer ') ? 'Bearer <redacted>' : h);
  next();
});

/* -------------------- Health check -------------------- */
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

/* -------------------- Public routes (NO auth) -------------------- */
// A1 local login routes
try {
  const authRouter = require('./routes/auth'); // CommonJS
  app.use('/api/auth', authRouter);
  console.log('[wire] /api/auth mounted');
} catch (e) {
  console.warn('[wire] /api/auth not mounted:', e.message);
}

// A2 Cognito routes (signup/confirm/login)
try {
  const cognitoRouter = require('./routes/cognito'); // CommonJS
  app.use('/api/cognito', cognitoRouter);
  console.log('[wire] /api/cognito mounted');
} catch (e) {
  console.warn('[wire] /api/cognito not mounted:', e.message);
}

/* -------------------- A1 protected routes (local JWT) -------------------- */
let authRequired = (_req, res, _next) => res.status(503).json({ error: 'A1 auth middleware missing' });
try {
  const mod = require('./middleware/auth');       // { authRequired, adminOnly }
  authRequired = mod.authRequired || mod;         // tolerate default export
  console.log('[wire] using A1 auth middleware from', require.resolve('./middleware/auth'));
} catch (e) {
  console.warn('[wire] middleware/auth.js not found:', e.message);
}

try {
  const filesRouter = require('./routes/files');
  app.use('/api', authRequired, filesRouter);     // e.g. /api/upload, /api/files
  console.log('[wire] /api (A1 protected) mounted');
} catch (e) {
  console.warn('[wire] /api files routes not mounted:', e.message);
}

/* -------------------- A2 protected routes (Cognito) -------------------- */
const requireAuth = (function () {
  try {
    const resolved = require.resolve('./middleware/requireAuth');
    console.log('[wire] using requireAuth from', resolved);
    const mod = require(resolved);
    return mod.default || mod;
  } catch (e) {
    console.error('[wire] failed to load middleware/requireAuth.js:', e.message);
    return (_req, res) => res.status(503).json({ error: 'Cognito auth not configured' });
  }
})();

// Debug helper router (mounted WITHOUT auth)
const debugRouter = express.Router();

// 1) Decode JWT header/payload (no verify)
debugRouter.get('/token', (req, res) => {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(400).json({ error: 'Missing token' });
  try {
    const decoded = require('jsonwebtoken').decode(m[1], { complete: true });
    res.json({ ok: true, header: decoded?.header, payload: decoded?.payload });
  } catch (e) {
    res.status(400).json({ error: 'Cannot decode token', detail: String(e) });
  }
});

// 2) Echo headers (is Authorization reaching backend?)
debugRouter.get('/echo', (req, res) => {
  res.json({ authorization: req.headers.authorization || '(none)', headers: req.headers });
});

// 3) Verify JWT via requireAuth and return req.user (proves JWKS/issuer/aud ok)
debugRouter.get('/verify', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.use('/api/cloud/_debug', debugRouter);

// Real cloud routes under Cognito protection
const cloudRouter = (function () {
  try {
    const mod = require('./routes/cloud');  // S3/Dynamo routes
    return mod.default || mod;
  } catch (e) {
    const r = express.Router();
    r.all('*', (_req, res) => res.status(501).json({ error: 'cloud routes not implemented' }));
    return r;
  }
})();
app.use('/api/cloud', requireAuth, cloudRouter);
console.log('[wire] /api/cloud (A2 protected) mounted');

/* -------------------- Front page -------------------- */
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* -------------------- 404 & error -------------------- */
app.use((req, res, _next) => {
  res.status(404).json({ error: 'not found', path: req.originalUrl });
});
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'internal error' });
});

/* -------------------- Start -------------------- */
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
