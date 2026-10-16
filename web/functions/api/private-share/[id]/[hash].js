import { json, sha256Hex } from '../../_lib/utils.js';

export async function onRequestGet({ env, params }) {
  const entryId = Number(params.id);
  const hash = typeof params.hash === 'string' ? params.hash.toLowerCase() : '';

  if (!Number.isFinite(entryId) || !/^[a-f0-9]{64}$/.test(hash)) {
    return json({ error: '分享链接无效。' }, { status: 400 });
  }

  const entry = await env.DB.prepare(
    'SELECT id, content, mood, weight, created_at, updated_at FROM entries WHERE id = ?'
  )
    .bind(entryId)
    .first();

  if (!entry) {
    return json({ error: '记录不存在。' }, { status: 404 });
  }

  const expectedHash = await sha256Hex(`${entry.id}:${entry.content}`);
  if (expectedHash !== hash) {
    return json({ error: '分享链接已失效。' }, { status: 404 });
  }

  return json(entry);
}
