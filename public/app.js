// public/app.js — final (CSP-safe, robust binding, strong logging)

// 0) 证明脚本已加载
console.log('[debug] app.js loaded');

// 0.1) 捕获前端错误，避免静默失败
window.addEventListener('error', (e) => {
  console.error('[debug] window.error', e.error || e.message || e);
  try { alert('JS error: ' + (e.message || String(e.error || e))); } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[debug] unhandledrejection', e.reason);
  try { alert('Promise error: ' + String(e.reason)); } catch (_) {}
});

// ======== State & helpers ========
let tokenA1 = null;           // local JWT for A1 routes
window.tokenA2 = window.tokenA2 || null; // Cognito ID token for A2 routes

// 与后端同源部署：直接用同源 /api
const API = location.origin + '/api';

const $ = (id) => document.getElementById(id);

function authHeadersA1() {
  return tokenA1 ? { 'Authorization': 'Bearer ' + tokenA1 } : {};
}
function authHeadersA2() {
  return window.tokenA2 ? { 'Authorization': 'Bearer ' + window.tokenA2 } : {};
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function renderResults(outId, items, source) {
  const box = $(outId);
  if (!box) return;
  if (!items || !items.length) { box.innerHTML = '<em>No results</em>'; return; }
  const grid = document.createElement('div'); grid.className = 'ext-grid';
  items.forEach(i => {
    const card = document.createElement('div'); card.className = 'ext-item';
    if (i.thumbnail) {
      const img = document.createElement('img'); img.src = i.thumbnail; img.alt = i.title || ''; img.onerror = () => (img.style.display = 'none');
      card.appendChild(img);
    }
    const title = document.createElement('div'); title.className = 'ext-title'; title.textContent = i.title || i.tags || ''; card.appendChild(title);
    const src = document.createElement('div'); src.className = 'ext-source'; src.textContent = source; card.appendChild(src);
    grid.appendChild(card);
  });
  box.innerHTML = ''; box.appendChild(grid);
}

function mkBtn(label, onClick) { const btn = document.createElement('button'); btn.textContent = label; btn.addEventListener('click', onClick); return btn; }
function humanMB(size) { if (!size && size !== 0) return '?'; return Math.round(size / 1024 / 1024) + ' MB'; }

// ==================== A2: Cognito ====================
// 只取 ID Token，避免 access token aud/scope 差异导致 401
function pickCognitoToken(payload) {
  const a = payload || {};
  const ar = a.AuthenticationResult || a.authResult || {};
  return (
    a.idToken || a.IdToken || a.id_token ||
    ar.IdToken || ar.idToken || ar.id_token ||
    null
  );
}

async function cg_signup() {
  const username = $('cg_username')?.value;
  const email = $('cg_email')?.value;
  const password = $('cg_password')?.value;
  const displayName = $('cg_display') ? $('cg_display').value : username;
  const resp = await fetch(API + '/cognito/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, displayName })
  });
  const data = await resp.json().catch(()=>({}));
  alert(resp.ok ? 'Sign-up OK. Check your email for the code.' : (data.error || 'Sign-up failed'));
}

async function cg_confirm() {
  const username = $('cg_username')?.value;
  const code = $('cg_code')?.value;
  const resp = await fetch(API + '/cognito/confirm', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, code })
  });
  const data = await resp.json().catch(()=>({}));
  alert(resp.ok ? 'Confirmation OK.' : (data.error || 'Confirmation failed'));
}

async function cg_login() {
  const username = $('cg_username_login')?.value;
  const password = $('cg_password_login')?.value;
  const resp = await fetch(API + '/cognito/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await resp.json().catch(()=>({}));

  if (resp.status === 409 && data.challenge) {
    alert(`Login requires challenge: ${data.challenge}. (UI for /respond not implemented here)`);
    return;
  }
  if (!resp.ok) { alert(data.error || 'Login failed'); return; }

  window.tokenA2 = pickCognitoToken(data);
  console.log('[cg_login] tokenA2 =', window.tokenA2 ? (window.tokenA2.split('.')[0] + '.<payload>.<sig>') : null);
  if (!window.tokenA2 || !/\w+\.\w+\.\w+/.test(window.tokenA2)) {
    alert('Cognito login returned no valid JWT'); return;
  }
  const w = $('cg_whoami'); if (w) w.textContent = 'Cognito login OK';
}

// ---- Debug helpers (CSP-friendly, 无内联) ----
async function debug_echo() {
  const headers = { ...authHeadersA2() };
  if (!headers.Authorization) { alert('No ID token. Please login via Cognito first.'); return; }
  console.log('[debug] echo -> with bearer');

  const resp = await fetch(API + '/cloud/_debug/echo', { headers });
  const data = await resp.json().catch(()=>({}));
  alert('echo:\n' + JSON.stringify(data, null, 2));
}

async function debug_verify() {
  const headers = { ...authHeadersA2() };
  if (!headers.Authorization) { alert('No ID token. Please login via Cognito first.'); return; }
  console.log('[debug] verify -> with bearer');

  const resp = await fetch(API + '/cloud/_debug/verify', { headers });
  const txt = await resp.text();
  alert('verify:\nHTTP ' + resp.status + '\n' + txt);
}

// ==================== A2: S3 ====================
async function s3_upload() {
  if (!window.tokenA2) return alert('Please login with Cognito (A2) first.');
  const key = $('s3_key')?.value;
  const file = $('s3_file')?.files?.[0];
  if (!file) return alert('Please choose a file.');

  const headers = { ...authHeadersA2(), 'Content-Type': 'application/json' };
  console.log('[s3_upload] using Authorization =', headers.Authorization ? (headers.Authorization.slice(0,30) + '...') : '(none)');

  // 1) get presigned PUT
  let resp = await fetch(API + '/cloud/s3/upload-url', {
    method: 'POST', headers, body: JSON.stringify({ key, contentType: file.type || 'application/octet-stream' })
  });
  let data = await resp.json().catch(()=>({}));
  if (!resp.ok) return alert(data.error || 'Failed to get presigned URL');

  // 2) upload directly to S3
  const putResp = await fetch(data.url, { method: 'PUT', body: file });
  const status = $('s3_status'); if (status) status.textContent = putResp.ok ? 'Uploaded to S3 ✅' : 'Upload failed ❌';
}

// ==================== A2: DynamoDB ====================
async function ddb_create() {
  if (!window.tokenA2) return alert('Please login with Cognito (A2) first.');
  const videoId = $('s3_key')?.value?.split('/')?.pop() || 'demo-001';
  const title = $('s3_title')?.value || 'Untitled';
  const s3Key = $('s3_key')?.value;
  const meta = { title, s3Key };

  const headers = { ...authHeadersA2(), 'Content-Type': 'application/json' };
  console.log('[ddb_create] using Authorization =', headers.Authorization ? (headers.Authorization.slice(0,30) + '...') : '(none)');

  const resp = await fetch(API + '/cloud/ddb/items', { method: 'POST', headers, body: JSON.stringify({ videoId, meta }) });
  const data = await resp.json().catch(()=>({}));
  alert(resp.ok ? ('Saved: ' + data.videoId) : (data.error || 'DynamoDB save failed'));
}

async function ddb_list() {
  if (!window.tokenA2) return alert('Please login with Cognito (A2) first.');
  const headers = authHeadersA2();
  console.log('[ddb_list] using Authorization =', headers.Authorization ? (headers.Authorization.slice(0,30) + '...') : '(none)');

  const resp = await fetch(API + '/cloud/ddb/items', { headers });
  const data = await resp.json().catch(()=>({}));
  const list = $('ddb_list');
  if (!list) return;
  list.innerHTML = '';
  (data.items || []).forEach(it => {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('div');
    title.innerHTML = `<strong>${escapeHtml(it.title || it.meta?.title || it.videoId)}</strong>`;
    card.appendChild(title);

    const vId = document.createElement('div');
    vId.innerHTML = `<small>videoId: ${escapeHtml(it.videoId)}</small>`;
    card.appendChild(vId);

    const s3 = document.createElement('div');
    const s3Key = it.s3Key || it.meta?.s3Key || '';
    s3.innerHTML = `<small>s3Key: ${escapeHtml(s3Key)}</small>`;
    card.appendChild(s3);

    const row = document.createElement('div');
    row.className = 'row';
    row.appendChild(mkBtn('Download (presigned)', () => downloadS3(s3Key)));
    row.appendChild(mkBtn('Delete', () => ddb_delete(it.videoId)));
    card.appendChild(row);

    const out = document.createElement('div');
    out.id = `out_ddb_${it.videoId}`;
    card.appendChild(out);

    list.appendChild(card);
  });
}

async function downloadS3(key) {
  if (!window.tokenA2) return alert('Please login with Cognito (A2) first.');
  if (!key) return alert('No s3Key.');
  const headers = authHeadersA2();
  console.log('[downloadS3] using Authorization =', headers.Authorization ? (headers.Authorization.slice(0,30) + '...') : '(none)');

  const resp = await fetch(API + '/cloud/s3/download-url/' + encodeURIComponent(key), { headers });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) return alert(data.error || 'Failed to get download URL');
  const a = document.createElement('a'); a.href = data.url; a.target = '_blank'; a.rel = 'noreferrer'; a.click();
}

async function ddb_delete(videoId) {
  if (!window.tokenA2) return alert('Please login with Cognito (A2) first.');
  const headers = authHeadersA2();
  console.log('[ddb_delete] using Authorization =', headers.Authorization ? (headers.Authorization.slice(0,30) + '...') : '(none)');

  const resp = await fetch(API + '/cloud/ddb/items/' + encodeURIComponent(videoId), {
    method: 'DELETE', headers
  });
  const data = await resp.json().catch(()=>({}));
  alert(resp.ok ? 'Deleted' : (data.error || 'Delete failed'));
  ddb_list();
}

// ======== A1: Local features ========
async function login() {
  const username = $('username')?.value;
  const password = $('password')?.value;
  const resp = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) return alert(data.error || 'Login failed');
  tokenA1 = data.token;
  const w = $('whoami'); if (w) w.textContent = 'Logged in as ' + (data.user?.username || username);
  loadFiles(1);
}

async function upload() {
  if (!tokenA1) return alert('Please login (A1) first.');
  const f = $('file')?.files?.[0];
  if (!f) return alert('Choose a file.');
  const fd = new FormData(); fd.append('file', f); fd.append('title', $('title')?.value || '');
  const resp = await fetch(API + '/upload', { method: 'POST', headers: authHeadersA1(), body: fd });
  const data = await resp.json().catch(()=>({}));
  if (!resp.ok) return alert(data.error || 'Upload failed');
  loadFiles(1);
}

async function loadFiles(page = 1) {
  if (!tokenA1) return;
  const q = $('q')?.value || ''; const sort = $('sort')?.value || 'uploadedAt'; const order = $('order')?.value || 'desc';
  const resp = await fetch(API + `/files?page=${page}&q=${encodeURIComponent(q)}&sort=${sort}&order=${order}`, {
    headers: authHeadersA1()
  });
  const data = await resp.json().catch(()=>({}));
  const box = $('files'); if (!box) return;
  box.innerHTML = '';

  (data.items || []).forEach(v => {
    const card = document.createElement('div'); card.className = 'card';
    const t = document.createElement('div'); t.innerHTML = `<strong>${escapeHtml(v.title || '')}</strong>`; card.appendChild(t);
    const meta = document.createElement('div'); meta.innerHTML = `<small>${escapeHtml(v.originalFilename || '')} (${humanMB(v.size)})</small>`; card.appendChild(meta);
    const row = document.createElement('div'); row.className = 'row';
    row.appendChild(mkBtn('Download original', () => downloadLocal(v.id, 'original')));
    row.appendChild(mkBtn('Transcode 720p (sync)', () => transcodeSync(v.id)));
    row.appendChild(mkBtn('Transcode 720p (async)', () => transcodeAsync(v.id)));
    row.appendChild(mkBtn('Generate thumbnails', () => thumbs(v.id)));
    row.appendChild(mkBtn('Show thumbnails', () => showThumbs(v.id)));
    row.appendChild(mkBtn('YouTube', () => yt(v.title || '', v.id)));
    row.appendChild(mkBtn('TMDB', () => tmdb(v.title || '', v.id)));
    row.appendChild(mkBtn('Pixabay', () => pixabay(v.title || '', v.id)));
    card.appendChild(row);
    const out = document.createElement('div'); out.id = `out_${v.id}`; card.appendChild(out);
    box.appendChild(card);
  });
}

function downloadLocal(id, variant) {
  const url = API + `/files/${id}/download?variant=${variant}`;
  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noreferrer'; a.click();
}

async function transcodeSync(id) {
  const resp = await fetch(API + '/transcode/sync', {
    method: 'POST', headers: { ...authHeadersA1(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, resolution: '1280x720', format: 'mp4' })
  });
  const data = await resp.json().catch(()=>({})); $(`out_${id}`).textContent = JSON.stringify(data);
}

async function transcodeAsync(id) {
  const resp = await fetch(API + '/transcode', {
    method: 'POST', headers: { ...authHeadersA1(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, resolution: '1280x720', format: 'mp4' })
  });
  const data = await resp.json().catch(()=>({})); $(`out_${id}`).textContent = 'Job ' + data.jobId + ' ' + data.status;
}

async function thumbs(id) {
  const resp = await fetch(API + '/thumbnails', {
    method: 'POST', headers: { ...authHeadersA1(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, everyN: 10 })
  });
  const data = await resp.json().catch(()=>({}));
  const out = $(`out_${id}`); if (!resp.ok) out.textContent = data.error || 'Failed to generate thumbnails'; else out.textContent = 'Generated in ' + data.dir;
}

async function yt(q, vid) {
  const resp = await fetch(API + '/external/youtube?q=' + encodeURIComponent(q), { headers: authHeadersA1() });
  const data = await resp.json().catch(()=>({})); if (!resp.ok) { alert(data.error || 'YouTube error'); return; }
  renderResults('out_' + vid, data.items, 'YouTube');
}
async function tmdb(q, vid) {
  const resp = await fetch(API + '/external/tmdb/search?q=' + encodeURIComponent(q), { headers: authHeadersA1() });
  const data = await resp.json().catch(()=>({})); if (!resp.ok) { alert(data.error || 'TMDB error'); return; }
  renderResults('out_' + vid, data.items, 'TMDB');
}
async function pixabay(q, vid) {
  const resp = await fetch(API + '/external/pixabay/search?q=' + encodeURIComponent(q), { headers: authHeadersA1() });
  const data = await resp.json().catch(()=>({})); if (!resp.ok) { alert(data.error || 'Pixabay error'); return; }
  renderResults('out_' + vid, data.items, 'Pixabay');
}
async function showThumbs(id) {
  const resp = await fetch(API + `/files/${id}/thumbnails`, { headers: authHeadersA1() });
  const data = await resp.json().catch(()=>({}));
  const out = $(`out_${id}`);
  if (!resp.ok) { out.innerHTML = `<em>Failed: ${data.error || 'unknown'}</em>`; return; }
  const items = data.items || [];
  if (!items.length) { out.innerHTML = '<em>No thumbnails</em>'; return; }
  const grid = document.createElement('div'); grid.className = 'ext-grid';
  items.forEach(i => {
    const card = document.createElement('div'); card.className = 'ext-item';
    const img = document.createElement('img'); img.src = i.url; img.alt = i.file; card.appendChild(img);
    const src = document.createElement('div'); src.className = 'ext-source'; src.textContent = i.file; card.appendChild(src);
    grid.appendChild(card);
  });
  out.innerHTML = ''; out.appendChild(grid);
}

// ======== 事件绑定（无内联；CSP 安全） ========
function bindDebugButtons() {
  const btnEcho = $('btnDebugEcho');
  const btnVerify = $('btnDebugVerify');
  let bound = 0;
  if (btnEcho && !btnEcho.__bound) { btnEcho.addEventListener('click', (e)=>{ e.preventDefault(); debug_echo(); }); btnEcho.__bound = true; bound++; console.log('[debug] bound #btnDebugEcho'); }
  if (btnVerify && !btnVerify.__bound) { btnVerify.addEventListener('click', (e)=>{ e.preventDefault(); debug_verify(); }); btnVerify.__bound = true; bound++; console.log('[debug] bound #btnDebugVerify'); }
  return bound > 0;
}

document.addEventListener('DOMContentLoaded', () => {
  const ok = bindDebugButtons();
  console.log('[debug] DOMContentLoaded -> bind', ok ? 'ok' : 'pending');

  // 绑定 A2
  $('btn_cg_signup')?.addEventListener('click', cg_signup);
  $('btn_cg_confirm')?.addEventListener('click', cg_confirm);
  $('btn_cg_login')?.addEventListener('click', cg_login);
  $('btn_s3_upload')?.addEventListener('click', s3_upload);
  $('btn_ddb_create')?.addEventListener('click', ddb_create);
  $('btn_ddb_list')?.addEventListener('click', ddb_list);

  // 绑定 A1
  $('btn_login')?.addEventListener('click', login);
  $('btn_upload')?.addEventListener('click', upload);
  $('q')?.addEventListener('input', () => loadFiles(1));
  $('sort')?.addEventListener('change', () => loadFiles(1));
  $('order')?.addEventListener('change', () => loadFiles(1));
});

// 若按钮是异步插入，做 3 秒兜底重试
(function retryBindLoop() {
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    const ok = bindDebugButtons();
    if (ok || tries >= 30) {
      clearInterval(t);
      console.log('[debug] retry bind ended ->', ok ? 'ok' : 'not found');
    }
  }, 100);
})();
