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

function safeFilename(name) {
  return (name || 'file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'file';
}

export async function onRequest({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: '未登录或登录已过期。' }, { status: 401 });
  }

  if (!env.FILES) {
    return json({ error: 'R2 存储桶未绑定。' }, { status: 500 });
  }

  await ensureFilesTable(env);

  if (request.method === 'GET') {
    const result = await env.DB.prepare(
      'SELECT id, filename, content_type, size, visibility, created_at FROM files WHERE user_id = ? ORDER BY created_at DESC'
    )
      .bind(user.id)
      .all();

    return json(result.results || []);
  }

  if (request.method === 'POST') {
    const formData = await request.formData();
    const uploaded = formData.get('file');

    if (!(uploaded instanceof File)) {
      return json({ error: '请选择要上传的文件。' }, { status: 400 });
    }

    const filename = safeFilename(uploaded.name);
    const contentType = uploaded.type || 'application/octet-stream';
    const entryIdValue = formData.get('entry_id');
    const entryId = entryIdValue ? Number(entryIdValue) : null;

    if (entryId !== null && !Number.isFinite(entryId)) {
      return json({ error: '关联记录 ID 无效。' }, { status: 400 });
    }

    const objectKey = `users/${user.id}/${crypto.randomUUID()}-${filename}`;
    await env.FILES.put(objectKey, uploaded.stream(), {
      httpMetadata: {
        contentType,
      },
      customMetadata: {
        filename,
        userId: String(user.id),
      },
    });

    const insertResult = await env.DB.prepare(
      'INSERT INTO files (user_id, entry_id, object_key, filename, content_type, size) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(user.id, entryId, objectKey, filename, contentType, uploaded.size || 0)
      .run();

    const file = await env.DB.prepare(
      'SELECT id, filename, content_type, size, visibility, created_at FROM files WHERE id = ?'
    )
      .bind(insertResult.meta.last_row_id)
      .first();

    return json(file, { status: 201 });
  }

  return json({ error: '不支持该请求方法。' }, { status: 405 });
}
