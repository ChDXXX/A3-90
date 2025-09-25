// services/s3.js — CommonJS
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET;

async function getUploadUrl(key, contentType, expiresSec = 900) {
  const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSec });
}

async function getDownloadUrl(key, expiresSec = 900) {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresSec });
}

module.exports = { getUploadUrl, getDownloadUrl };
