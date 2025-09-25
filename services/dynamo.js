// services/dynamo.js
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const TABLE = process.env.DDB_TABLE;

export async function saveItem(owner, videoId, meta = {}) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { owner, videoId, ...meta, updatedAt: Date.now() }
  }));
}

export async function listItems(owner, limit = 20, cursor) {
  const params = {
    TableName: TABLE,
    KeyConditionExpression: "owner = :o",
    ExpressionAttributeValues: { ":o": owner },
    Limit: limit
  };
  if (cursor) params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, "base64").toString());
  const out = await ddb.send(new QueryCommand(params));
  const next = out.LastEvaluatedKey ? Buffer.from(JSON.stringify(out.LastEvaluatedKey)).toString("base64") : null;
  return { items: out.Items || [], next };
}

export async function removeItem(owner, videoId) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { owner, videoId } }));
}
