import { json } from '../../_lib/utils.js';

export async function onRequestGet({ env, params }) {
  const entryId = Number(params.id);
  if (!Number.isFinite(entryId)) {
    return json({ error: '记录 ID 无效。' }, { status: 400 });
  }

  const entry = await env.DB.prepare(
    'SELECT id, content, mood, weight, created_at, updated_at FROM entries WHERE id = ? AND visibility = ?'
  )
    .bind(entryId, 'public')
    .first();

  if (!entry) {
    return json({ error: '记录不存在或未公开。' }, { status: 404 });
  }

  return json(entry);
}
