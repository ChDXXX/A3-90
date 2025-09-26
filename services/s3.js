// services/s3.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { fromNodeProviderChain } = require('@aws-sdk/credential-provider-node');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const BUCKET = process.env.S3_BUCKET;

if (!BUCKET) {
  console.warn('[S3] WARN: env S3_BUCKET is not set. Presign will fail without it.');
}

const s3 = new S3Client({
  region: REGION,
});

/**
 * @param {string} key
 * @param {string} contentType 
 * @param {number} expiresIn 
 * @returns {Promise<string>}
 */
exports.getUploadUrl = async (key, contentType, expiresIn = 300) => {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn });
  return url;
};


exports.getDownloadUrl = async (key, expiresIn = 300) => {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return await getSignedUrl(s3, cmd, { expiresIn });
};

exports.deleteObject = async (key) => {
  const cmd = new DeleteObjectCommand({ Bucket: BUCKET, Key: key });
  await s3.send(cmd);
};
