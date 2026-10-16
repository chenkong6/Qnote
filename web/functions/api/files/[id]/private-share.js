import { getBearerToken, json, sha256Hex, verifyToken } from '../../_lib/utils.js';

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

function fileShareSeed(file) {
  return `${file.id}:${file.object_key}:${file.filename}:${file.size}:${file.content_type}`;
}

export async function onRequestPost({ request, env, params }) {
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: '未登录或登录已过期。' }, { status: 401 });
  }

  await ensureFilesTable(env);

  const fileId = Number(params.id);
  if (!Number.isFinite(fileId)) {
    return json({ error: '文件 ID 无效。' }, { status: 400 });
  }

  const file = await env.DB.prepare('SELECT id, object_key, filename, content_type, size FROM files WHERE id = ? AND user_id = ?')
    .bind(fileId, user.id)
    .first();

  if (!file) {
    return json({ error: '文件不存在。' }, { status: 404 });
  }

  const hash = await sha256Hex(fileShareSeed(file));
  return json({ token: `${file.id}-${hash}`, hash });
}
