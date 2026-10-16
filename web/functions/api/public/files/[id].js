import { json } from '../../_lib/utils.js';
import { fileObjectResponse, filePreviewPage } from '../../_lib/file-preview.js';

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

export async function onRequestGet({ request, env, params }) {
  if (!env.FILES) {
    return json({ error: 'R2 存储桶未绑定。' }, { status: 500 });
  }

  await ensureFilesTable(env);

  const fileId = Number(params.id);
  if (!Number.isFinite(fileId)) {
    return json({ error: '文件 ID 无效。' }, { status: 400 });
  }

  const file = await env.DB.prepare('SELECT * FROM files WHERE id = ? AND visibility = ?')
    .bind(fileId, 'public')
    .first();

  if (!file) {
    return json({ error: '文件不存在或未公开。' }, { status: 404 });
  }

  const url = new URL(request.url);
  const shouldStream = url.searchParams.get('download') === '1' || url.searchParams.get('raw') === '1';
  if (!shouldStream) {
    return filePreviewPage(request, file, '公开文件');
  }

  const object = await env.FILES.get(file.object_key);
  if (!object) {
    return json({ error: 'R2 中未找到该文件。' }, { status: 404 });
  }

  return fileObjectResponse(object, file, { inline: url.searchParams.get('raw') === '1' });
}
