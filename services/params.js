// services/params.js
// Read public, non-sensitive config from SSM Parameter Store
const { SSMClient, GetParametersCommand } = require("@aws-sdk/client-ssm");

const ssm = new SSMClient({ region: process.env.AWS_REGION });

/**
 * getPublicConfig: fetch selected parameters by names defined in .env
 * ENV:
 *  - SSM_PUBLIC_API_BASE=/cab432/<you>/PUBLIC_API_BASE
 *  - SSM_UPLOAD_MAX_MB=/cab432/<you>/UPLOAD_MAX_SIZE_MB
 */
async function getPublicConfig() {
  const names = [
    process.env.SSM_PUBLIC_API_BASE,
    process.env.SSM_UPLOAD_MAX_MB,
  ].filter(Boolean);

  if (!names.length) return { apiBase: "", uploadMaxMB: 0 };

  const out = await ssm.send(new GetParametersCommand({
    Names: names,
    WithDecryption: false, // public info — no decryption needed
  }));

  const map = Object.fromEntries((out.Parameters || []).map(p => [p.Name, p.Value]));
  return {
    apiBase: map[process.env.SSM_PUBLIC_API_BASE] || "",
    uploadMaxMB: Number(map[process.env.SSM_UPLOAD_MAX_MB] || 0),
  };
}

module.exports = { getPublicConfig };
