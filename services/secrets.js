// services/secrets.js  — CommonJS version, production-ready
// English code with Chinese comments

const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const REGION = process.env.AWS_REGION || "ap-southeast-2";
const SECRET_ID = process.env.SECRET_WEBHOOK || "/A2-80/WEBHOOK_SECRET";
// 当 Secret 是“键/值对(JSON)”时要取的键名；纯文本密钥可忽略
const SECRET_KEY = process.env.WEBHOOK_SECRET_KEY || "mysecret";
// 可选：Secrets 不可用时回退到 .env 明文（仅开发/演示）
const FALLBACK_PLAIN = process.env.WEBHOOK_SECRET_PLAIN || "";
// 内存缓存 TTL（毫秒）
const CACHE_TTL_MS = Number(process.env.SECRETS_CACHE_TTL_MS || 60_000);

const sm = new SecretsManagerClient({ region: REGION });
const _cache = new Map();

/** 读取原始 SecretString，带简单缓存 */
async function readSecretRaw(id = SECRET_ID) {
  if (!id) throw new Error("SecretId is empty");
  const now = Date.now();
  const hit = _cache.get(id);
  if (hit && now - hit.time < CACHE_TTL_MS) return hit.value;

  const out = await sm.send(new GetSecretValueCommand({ SecretId: id })); // 默认 AWSCURRENT
  const raw = out.SecretString || "";
  _cache.set(id, { value: raw, time: now });
  return raw;
}

/**
 * 返回对象形式的密钥：
 * - 纯文本 => { value: "<text>" }
 * - JSON   => 解析后的对象
 */
async function getSecretObject(id = SECRET_ID) {
  try {
    const raw = await readSecretRaw(id);
    if (!raw) return {};
    if (raw[0] !== "{") return { value: raw }; // 纯文本
    return JSON.parse(raw);                     // JSON
  } catch (e) {
    if (FALLBACK_PLAIN) return { value: FALLBACK_PLAIN };
    throw e;
  }
}

/**
 * 直接拿用于 HMAC 的密钥字符串：
 * - 纯文本：直接返回
 * - JSON：取 SECRET_KEY 对应字段；没有则取第一个字符串值
 * - 失败时若设置了 FALLBACK_PLAIN，则返回该兜底
 */
async function getWebhookSecret() {
  const obj = await getSecretObject();
  if (typeof obj.value === "string" && obj.value.length > 0) return obj.value; // 纯文本
  const keyed = obj && obj[SECRET_KEY];
  if (typeof keyed === "string" && keyed.length > 0) return keyed;
  const firstStr = obj && Object.values(obj).find(v => typeof v === "string" && v.length > 0);
  if (firstStr) return firstStr;
  if (FALLBACK_PLAIN) return FALLBACK_PLAIN;
  throw new Error("Secret is empty or invalid shape");
}

module.exports = { getSecretObject, getWebhookSecret };
