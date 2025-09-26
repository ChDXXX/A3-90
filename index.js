// index.js — SAFE DEBUG FIRST (force-bypass auth for /_debug & /_ping)
require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* ---------- 0) 注册“绝对不受任何鉴权影响”的调试与健康路由（放在一切之前） ---------- */
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
app.use('/_debug', rootDebug); // ← 提前挂载，确保任何后续中间件都不会影响这里

/* ---------- 1) 再配置安全头、解析器、静态资源等 ---------- */
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

// 打印 Authorization（为了观察是否带到）
app.use((req, _res, next) => {
  const h = req.headers.authorization || '(none)';
  console.log('[AUTH]', req.method, req.url, h.startsWith('Bearer ') ? 'Bearer <redacted>' : h);
  next();
});

// 健康检查
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

/* ---------- 2) 公共路由（无需鉴权） ---------- */
try { app.use('/api/auth', require('./routes/auth')); console.log('[wire] /api/auth mounted'); }
catch (e) { console.warn('[wire] /api/auth not mounted:', e.message); }

try { app.use('/api/cognito', require('./routes/cognito')); console.log('[wire] /api/cognito mounted'); }
catch (e) { console.warn('[wire] /api/cognito not mounted:', e.message); }

/* ---------- 3) 受保护的路由（明确只保护 /api/cloud 和 /api/* 文件路由） ---------- */
let authRequired = (_req, res) => res.status(503).json({ error: 'A1 auth middleware missing' });
try { const mod = require('./middleware/auth'); authRequired = mod.authRequired || mod; }
catch (e) { console.warn('[wire] A1 middleware not loaded:', e.message); }

let requireAuth = (_req, res) => res.status(503).json({ error: 'Cognito auth not configured' });
try { const mod = require('./middleware/requireAuth'); requireAuth = mod.default || mod; }
catch (e) { console.warn('[wire] requireAuth not loaded:', e.message); }

try { app.use('/api', authRequired, require('./routes/files')); console.log('[wire] /api (A1 protected) mounted'); }
catch (e) { console.warn('[wire] /api files routes not mounted:', e.message); }

try { const cloudRouter = require('./routes/cloud'); app.use('/api/cloud', requireAuth, cloudRouter); console.log('[wire] /api/cloud (A2 protected) mounted'); }
catch (e) { console.warn('[wire] /api/cloud routes not mounted:', e.message); }

/* ---------- 4) 前端页面 ---------- */
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

/* ---------- 5) 404 & error ---------- */
app.use((req, res) => res.status(404).json({ error: 'not found', path: req.originalUrl }));
app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || 'internal error' });
});

/* ---------- 6) 启动 ---------- */
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
