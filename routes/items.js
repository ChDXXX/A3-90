// routes/items.js
import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { saveItem, listItems, removeItem } from "../services/dynamo.js";
import { v4 as uuid } from "uuid";

const r = Router();

r.get("/", requireAuth, async (req, res) => {
  const owner = req.user?.sub;
  const { limit = 20, cursor } = req.query;
  const out = await listItems(owner, Number(limit), cursor);
  res.json(out);
});

r.post("/", requireAuth, async (req, res) => {
  const owner = req.user?.sub;
  const videoId = req.body.videoId || uuid();
  const meta = req.body.meta || {};
  await saveItem(owner, videoId, meta);
  res.status(201).json({ owner, videoId, meta });
});

r.delete("/:videoId", requireAuth, async (req, res) => {
  const owner = req.user?.sub;
  await removeItem(owner, req.params.videoId);
  res.json({ ok: true });
});

export default r;
