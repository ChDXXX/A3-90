import { createClient } from "redis";
const client = createClient({ url: process.env.REDIS_URL });
client.on("error", (e) => console.error("Redis error", e));
await client.connect();

export async function withCache(key, ttlSec, loader) {
  const v = await client.get(key);
  if (v) return JSON.parse(v);
  const data = await loader();
  await client.set(key, JSON.stringify(data), { EX: ttlSec });
  return data;
}
