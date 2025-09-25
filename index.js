// index.js — final wiring for A1 + A2
require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* -------------------- Security headers (strict CSP, no inline) -------------------- */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // Only our own scripts, no inline/event handlers
      "script-src": ["'self'"],
      "script-src-attr": ["'none'"],
      // Allow self + data + any https images (YouTube/TMDB/Pixabay thumbnails)
      "img-src": ["'self'", "data:", "https:"],
      // If you directly play media from https origins, uncomment below
      // "media-src": ["'self'", "https:"],
      // Allow XHR/fetch to https APIs (S3 presigned, 3rd party, etc.)
      "connect-src": ["'self'", "https:"],
      // We keep style inline-safe for quick UI, remove if you enforce CSS files only
      "style-src": ["'self'", "https:", "'unsafe-inline'"]
    }
  },
  hsts: { maxAge: 60 * 60 * 24 * 180, includeSubDomains: true } // 180 days
}));

/* -------------------- Logs, parsers, static -------------------- */
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

/* -------------------- Health check -------------------- */
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

/* -------------------- Public routes (NO auth) -------------------- */
// A1 local login routes
let authRouter;
try {
  const mod = require('./routes/auth');           // supports default or { authRouter }
  authRouter = mod.authRouter || mod;
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

try {
  const externalRouter = require('./routes/external');
  app.use('/api/external', authRequired, externalRouter); // /api/external/*
  console.log('[wire] /api/external (A1 protected) mounted');
} catch (e) {
  console.warn('[wire] /api/external not mounted:', e.message);
}

/* -------------------- A2 protected routes (Cognito) -------------------- */
// Print the actual middleware file path to avoid wrong require
const requireAuth = (function () {
  try {
    const resolved = require.resolve('./middleware/requireAuth');
    console.log('[wire] using requireAuth from', resolved);
    const mod = require(resolved);
    // v3+ prints "[requireAuth vX.Y] loaded" on module load
    return mod.default || mod;
  } catch (e) {
    console.error('[wire] failed to load middleware/requireAuth.js:', e.message);
    // SAFETY: block cloud APIs if auth is not configured
    return (_req, res) => res.status(503).json({ error: 'Cognito auth not configured' });
  }
})();

// Debug-only route: decode Bearer without verifying (helps diagnose 401)
const debugRouter = express.Router();
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
app.use('/api/cloud/_debug', debugRouter);

// Real cloud routes under Cognito protection
const cloudRouter = (function () {
  try {
    const mod = require('./routes/cloud');  // your S3/Dynamo routes
    return mod.default || mod;
  } catch (e) {
    const r = express.Router();
    r.all('*', (_req, res) => res.status(501).json({ error: 'cloud routes not implemented' }));
    return r;
  }
})();
app.use('/api/cloud', requireAuth, cloudRouter);
console.log('[wire] /api/cloud (A2 protected) mounted');

/* -------------------- Front page (serve index.html) -------------------- */
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* -------------------- 404 & error handler -------------------- */
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
