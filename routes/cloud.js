// routes/cloud.js  — CommonJS (avoid ESM in "type": "commonjs" project)
const express = require('express');
const { getUploadUrl, getDownloadUrl } = require('../services/s3.js');
const { saveItem, listItems, removeItem } = require('../services/dynamo.js');
const { v4: uuid } = require('uuid');

const r = express.Router();

/**
 * 获取 S3 直传 URL（前端用该 URL 直接 PUT 到 S3）
 * body: { key, contentType }
 * 受保护：通过上游 app.use('/api/cloud', requireAuth, r)
 */
r.post('/s3/upload-url', async (req, res) => {
  try {
    const { key, contentType = 'application/octet-stream' } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Missing key' });

    const url = await getUploadUrl(key, contentType);
    const owner = req.user?.sub || 'demo-owner';
    return res.json({ url, key, owner });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get presigned URL', detail: String(e) });
  }
});

/**
 * 获取下载 URL（可选）
 * query: key
 */
r.get('/s3/download-url', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'Missing key' });
    const url = await getDownloadUrl(key);
    return res.json({ url, key });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get download URL', detail: String(e) });
  }
});

/**
 * DDB：保存元数据
 * body: { title, description, s3Key, thumbs? }
 */
r.post('/ddb/items', async (req, res) => {
  try {
    const owner = req.user?.sub || 'demo-owner';
    const videoId = uuid();
    const payload = { ...req.body, videoId, owner, createdAt: Date.now() };
    await saveItem(owner, videoId, payload);
    res.json({ ok: true, item: payload });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save item', detail: String(e) });
  }
});

/**
 * DDB：查询元数据（分页）
 */
r.get('/ddb/items', async (req, res) => {
  try {
    const owner = req.user?.sub || 'demo-owner';
    const { limit = 20, cursor } = req.query;
    const out = await listItems(owner, Number(limit), cursor);
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: 'Failed to list items', detail: String(e) });
  }
});

/**
 * DDB：删除某条元数据
 */
r.delete('/ddb/items/:videoId', async (req, res) => {
  try {
    const owner = req.user?.sub || 'demo-owner';
    await removeItem(owner, req.params.videoId);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete item', detail: String(e) });
  }
});

module.exports = r;
