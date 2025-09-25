// routes/cloud.js
import { Router } from "express";
import { getUploadUrl, getDownloadUrl } from "../services/s3.js";
import { saveItem, listItems, removeItem } from "../services/dynamo.js";
import { v4 as uuid } from "uuid";

const r = Router();

/**
 * 获取 S3 直传 URL（前端用该 URL 直接 PUT 到 S3）
 * body: { key, contentType }
 */
r.post("/s3/upload-url", async (req, res) => {
  const { key, contentType = "application/octet-stream" } = req.body || {};
  if (!key) return res.status(400).json({ error: "Missing key" });
  const url = await getUploadUrl(key, contentType);
  res.json({ url, key });
});

/**
 * 获取 S3 直下 URL（前端用该 URL 直接 GET S3 对象）
 */
r.get("/s3/download-url/:key", async (req, res) => {
  const url = await getDownloadUrl(req.params.key);
  res.json({ url });
});

/**
 * DDB：保存一条视频元数据（最少包含 videoId / title 等）
 * body: { videoId?, meta? }
 */
r.post("/ddb/items", async (req, res) => {
  const owner = req.user?.sub || "demo-owner";
  const videoId = req.body.videoId || uuid();
  const meta = req.body.meta || {};
  await saveItem(owner, videoId, meta);
  res.status(201).json({ owner, videoId, meta });
});

/**
 * DDB：分页列出当前用户的元数据
 * query: ?limit=20&cursor=base64
 */
r.get("/ddb/items", async (req, res) => {
  const owner = req.user?.sub || "demo-owner";
  const { limit = 20, cursor } = req.query;
  const out = await listItems(owner, Number(limit), cursor);
  res.json(out);
});

/**
 * DDB：删除某条元数据
 */
r.delete("/ddb/items/:videoId", async (req, res) => {
  const owner = req.user?.sub || "demo-owner";
  await removeItem(owner, req.params.videoId);
  res.json({ ok: true });
});

export default r;
