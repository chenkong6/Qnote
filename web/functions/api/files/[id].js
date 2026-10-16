import { getBearerToken, json, verifyToken } from '../_lib/utils.js';

async function requireUser(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;
  return verifyToken(token, env.JWT_SECRET);
}

async function ensureFilesTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      entry_id INTEGER,
      object_key TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT DEFAULT 'application/octet-stream',
      size INTEGER DEFAULT 0,
      visibility TEXT DEFAULT 'private',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(entry_id) REFERENCES entries(id)
    )
  `).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id)').run();
}

function contentDisposition(filename) {
  const fallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '\\"');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function onRequest({ request, env, params }) {
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: '未登录或登录已过期。' }, { status: 401 });
  }

  if (!env.FILES) {
    return json({ error: 'R2 存储桶未绑定。' }, { status: 500 });
  }

  await ensureFilesTable(env);

  const fileId = Number(params.id);
  if (!Number.isFinite(fileId)) {
    return json({ error: '文件 ID 无效。' }, { status: 400 });
  }

  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?')
    .bind(fileId, user.id)
    .first();

  if (!file) {
    return json({ error: '文件不存在。' }, { status: 404 });
  }

  if (request.method === 'GET') {
    const object = await env.FILES.get(file.object_key);
    if (!object) {
      return json({ error: 'R2 中未找到该文件。' }, { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('content-type', file.content_type || headers.get('content-type') || 'application/octet-stream');
    headers.set('content-disposition', contentDisposition(file.filename));
    if (file.size) headers.set('content-length', String(file.size));

    return new Response(object.body, { headers });
  }

  if (request.method === 'DELETE') {
    await env.FILES.delete(file.object_key);
    await env.DB.prepare('DELETE FROM files WHERE id = ? AND user_id = ?')
      .bind(fileId, user.id)
      .run();

    return new Response(null, { status: 204 });
  }

  return json({ error: '不支持该请求方法。' }, { status: 405 });
}
