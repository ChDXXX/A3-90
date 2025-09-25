// services/params.js
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";
const ssm = new SSMClient({ region: process.env.AWS_REGION });
export async function getParam(name, decrypt=true){
  const out = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: decrypt }));
  return out.Parameter?.Value;
}
