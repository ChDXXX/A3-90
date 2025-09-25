// services/secrets.js
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
const sm = new SecretsManagerClient({ region: process.env.AWS_REGION });
export async function getSecret(id){
  const out = await sm.send(new GetSecretValueCommand({ SecretId: id }));
  return out.SecretString ? JSON.parse(out.SecretString) : {};
}
