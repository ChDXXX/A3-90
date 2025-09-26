// index.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

function asMiddleware(mod, name) {
  const v = mod && (mod.default || mod);
  const t = typeof v;
  console.log(`[wire] resolving ${name}:`, t);
  return v;
}

app.get('/_ping', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const rootDebug = express.Router();
rootDebug.get('/echo', (req, res) => {
  res.json({ authorization: req.headers.authorization || '(none)', headers: req.headers });
});
rootDebug.get('/token', (req, res) => {
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
app.use('/_debug', rootDebug);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "script-src": ["'self'"],
      "script-src-attr": ["'none'"],
      "img-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https:"],
      "style-src": ["'self'", "https:", "'unsafe-inline'"]
    }
  },
  hsts: { maxAge: 60 * 60 * 24 * 180, includeSubDomains: true }
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));

app.use((req, _res, next) => {
  const h = req.headers.authorization || '(none)';
  console.log('[AUTH]', req.method, req.url, h.startsWith('Bearer ') ? 'Bearer <redacted>' : h);
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

try { app.use('/api/auth', asMiddleware(require('./routes/auth'), 'authRouter')); console.log('[wire] /api/auth mounted'); }
catch (e) { console.warn('[wire] /api/auth not mounted:', e.message); }

try { app.use('/api/cognito', asMiddleware(require('./routes/cognito'), 'cognitoRouter')); console.log('[wire] /api/cognito mounted'); }
catch (e) { console.warn('[wire] /api/cognito not mounted:', e.message); }

try {
  const a1 = asMiddleware(require('./middleware/auth'), 'authRequired');
  const filesRouter = asMiddleware(require('./routes/files'), 'filesRouter');
  app.use('/api', a1, filesRouter);
  console.log('[wire] /api (A1 protected) mounted');
} catch (e) {
  console.warn('[wire] /api files routes not mounted:', e.message);
}

let requireAuth = (_req, res) => res.status(503).json({ error: 'Cognito auth not configured' });
try { requireAuth = asMiddleware(require('./middleware/requireAuth'), 'requireAuth'); }
catch (e) { console.warn('[wire] requireAuth not loaded:', e.message); }

try {
  const cloudRouter = asMiddleware(require('./routes/cloud'), 'cloudRouter');
  app.use('/api/cloud',
    (req, res, next) => { console.log('[wire] /api/cloud gate'); return requireAuth(req, res, next); },
    cloudRouter
  );
  console.log('[wire] /api/cloud (A2 protected) mounted');
} catch (e) {
  console.warn('[wire] /api/cloud routes not mounted:', e.message);
}

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((req, res) => res.status(404).json({ error: 'not found', path: req.originalUrl }));
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});


app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);

});
app.use("/api/sse", require("./routes/sse"));