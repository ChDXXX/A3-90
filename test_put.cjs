// test_put.cjs  —— CommonJS 版本
const fs = require('fs');

const url = process.argv[2];
const file = process.argv[3];
const ctype = process.argv[4] || 'application/octet-stream';

if (!url || !file) {
  console.error('Usage: node test_put.cjs "<PRESIGNED_URL>" <file> [contentType]');
  process.exit(1);
}

const buf = fs.readFileSync(file);

(async () => {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': ctype },
      body: buf
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log(text); // S3 失败时这里会包含 <Code>...</Code>，用来精准判断
  } catch (e) {
    console.error('Request failed:', e);
  }
})();
