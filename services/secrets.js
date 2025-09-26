// services/secrets.js
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const REGION = process.env.AWS_REGION || "ap-southeast-2";
const sm = new SecretsManagerClient({ region: REGION });
const SECRET_CACHE = new Map();

exports.getSecretJson = async (name) => {
  if (SECRET_CACHE.has(name)) return SECRET_CACHE.get(name);
  const out = await sm.send(new GetSecretValueCommand({ SecretId: name }));
  const val = JSON.parse(out.SecretString || "{}");
  SECRET_CACHE.set(name, val);
  return val;
};

exports.getWebhookSecret = async () => {
  const j = await exports.getSecretJson("A2-80/webhook"); 
  return j.SECRET || j.value || "";
};

module.exports = {
  getSecretJson,
  getWebhookSecret,
};