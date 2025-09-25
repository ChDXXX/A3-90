// services/dynamo.js — CommonJS
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const TABLE = process.env.DDB_TABLE;

async function saveItem(owner, videoId, meta = {}) {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { owner, videoId, ...meta, updatedAt: Date.now() }
  }));
}

async function listItems(owner, limit = 20, cursor) {
  const params = {
    TableName: TABLE,
    KeyConditionExpression: 'owner = :o',
    ExpressionAttributeValues: { ':o': owner },
    Limit: limit
  };
  if (cursor) params.ExclusiveStartKey = JSON.parse(Buffer.from(cursor, 'base64').toString());
  const out = await ddb.send(new QueryCommand(params));
  const next = out.LastEvaluatedKey ? Buffer.from(JSON.stringify(out.LastEvaluatedKey)).toString('base64') : null;
  return { items: out.Items || [], next };
}

async function removeItem(owner, videoId) {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { owner, videoId } }));
}

module.exports = { saveItem, listItems, removeItem };
