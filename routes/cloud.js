// routes/cloud.js
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { v4: uuid } = require('uuid');

const requireAuth = require('../middleware/requireAuth');
const requireGroup = require('../middleware/requireGroup');

const { getUploadUrl, getDownloadUrl } = require('../services/s3.js');
const { saveItem, listItems, removeItem } = require('../services/dynamo.js');
const { getPublicConfig } = require('../services/params.js');
const { getWebhookSecret } = require('../services/secrets.js');

const r = express.Router();

function sanitize(name) {
  return path.basename(name || 'file.bin').replace(/[^\w.\-()+\s]/g, '_');
}

function getQutUsername(req) {
  if (process.env.QUT_USERNAME) return process.env.QUT_USERNAME.trim();
  const jwt = req.jwt || {};
  const email = (jwt.email || '').trim();
  const uname = (jwt['cognito:username'] || jwt.username || '').trim();
  return email || uname || null;
}

function normalizeVideoId(src = {}) {
  return src.videoid || src.videoId || src.key || null;
}

// （可选）调试路由，确认 mount 前缀： GET /api/cloud/_debug/ping 应返回 {ok:true}
r.get('/_debug/ping', (_req, res) => res.json({ ok: true, at: '/api/cloud' }));

// S3: 预签名上传URL（需要登录）
r.post('/s3/upload-url', requireAuth, async (req, res) => {
  try {
    const filename = sanitize(req.body?.filename || req.body?.key || 'file.bin');
    const contentType = req.body?.contentType || 'application/octet-stream';

    const owner = getQutUsername(req) || 'anonymous';
    const date = new Date().toISOString().slice(0, 10);
    const key = `uploads/${owner}/${date}/${uuid()}_${filename}`;

    const url = await getUploadUrl(key, contentType, 300);
    console.log('[s3] presign PUT ->', { key, contentType, owner });
    res.json({ url, key, owner });
  } catch (e) {
    console.error('[s3] presign error:', e);
    res.status(500).json({ error: 'Failed to get presigned URL' });
  }
});

// S3: 下载URL（可匿名/按需改）
r.get('/s3/download-url/:key(*)?', async (req, res) => {
  try {
    const keyRaw = req.params.key ?? req.query.key;
    if (!keyRaw) return res.status(400).json({ error: 'Missing key' });

    const key = decodeURIComponent(String(keyRaw)).replace(/^\/+/, '');

    const disposition = req.query.disposition === 'attachment' ? 'attachment' : 'inline';
    const filename = (key.split('/').pop() || 'download.bin').replace(/"/g, '');

    let url;
    try {
      url = await getDownloadUrl(key, 300, {
        responseContentDisposition: `${disposition}; filename="${filename}"`
      });
    } catch {
      url = await getDownloadUrl(key);
    }

    return res.json({ url, key, disposition });
  } catch (e) {
    console.error('[s3] download-url error:', e);
    return res.status(500).json({ error: 'Failed to get download URL', detail: String(e?.message || e) });
  }
});

// DDB: 新建/保存
r.post('/ddb/items', async (req, res) => {
  try {
    const qutUsername = getQutUsername(req);
    if (!qutUsername) return res.status(401).json({ error: 'unauthorized', code: 'NO_QUT_USERNAME' });

    const videoid = normalizeVideoId(req.body) || uuid();

    const base = { ...req.body };
    delete base.videoId;
    delete base.key;
    delete base.owner;

    const meta = {
      ...base,
      videoid,
      videoId: videoid,
      createdAt: Date.now(),
      'qut-username': qutUsername,
      owner: qutUsername,
    };

    // 注意：这里沿用你当前的签名 (qutUsername, videoid, meta)
    const item = await saveItem(qutUsername, videoid, meta);
    return res.json({ ok: true, item, saved: videoid });
  } catch (e) {
    console.error('[ddb/create] error:', e);
    return res.status(500).json({ error: 'Failed to save item', detail: String(e?.message || e) });
  }
});

// DDB: 列表
r.get('/ddb/items', async (req, res) => {
  try {
    const qutUsername = getQutUsername(req);
    if (!qutUsername) return res.status(401).json({ error: 'unauthorized', code: 'NO_QUT_USERNAME' });

    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Math.min(Math.max(rawLimit || 20, 1), 100);
    const cursor = req.query.cursor;

    const out = await listItems(qutUsername, limit, cursor);

    const items = (out.items || []).map(it => ({
      ...it,
      videoId: it.videoId || it.videoid
    }));

    return res.json({ ok: true, items, next: out.next });
  } catch (e) {
    console.error('[ddb/list] error:', e);
    return res.status(500).json({ error: 'Failed to list items', detail: String(e?.message || e) });
  }
});

// DDB: 删除（Admin 组）
r.delete('/ddb/items/:videoid', requireGroup('Admin'), async (req, res) => {
  try {
    const qutUsername = getQutUsername(req);
    if (!qutUsername) return res.status(401).json({ error: 'unauthorized', code: 'NO_QUT_USERNAME' });

    const { videoid } = req.params;
    const out = await removeItem(qutUsername, videoid);
    return res.json(out);
  } catch (e) {
    console.error('[ddb/delete] error:', e);
    return res.status(500).json({ error: 'Failed to delete item', detail: String(e?.message || e) });
  }
});

// 公共配置
r.get('/config/public', async (_req, res) => {
  try {
    const cfg = await getPublicConfig();
    res.json(cfg);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load config', detail: String(e?.message || e) });
  }
});

// Webhook 测试
r.post('/webhook/test', express.text({ type: '*/*' }), async (req, res) => {
  try {
    const secret = await getWebhookSecret();
    const body = req.body || '';
    const expect = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const got = req.get('x-signature') || '';

    if (got !== expect) return res.status(401).json({ error: 'bad signature' });
    res.json({ ok: true, echo: body.length, alg: 'HMAC-SHA256-hex' });
  } catch (e) {
    res.status(500).json({ error: 'webhook failed', detail: String(e?.message || e) });
  }
});

module.exports = r;
