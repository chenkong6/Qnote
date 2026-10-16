import { getBearerToken, json, readJson, verifyToken } from '../../_lib/utils.js';

async function requireUser(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return verifyToken(token, env.JWT_SECRET);
}

export async function onRequestPost({ request, env, params }) {
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: '未登录或登录已过期。' }, { status: 401 });
  }

  const entryId = Number(params.id);
  if (!Number.isFinite(entryId)) {
    return json({ error: '记录 ID 无效。' }, { status: 400 });
  }

  const body = await readJson(request);
  const visibility = body?.visibility === 'private' ? 'private' : 'public';

  const result = await env.DB.prepare('UPDATE entries SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
    .bind(visibility, entryId, user.id)
    .run();

  if (result.meta.changes === 0) {
    return json({ error: '记录不存在。' }, { status: 404 });
  }

  return json({ visibility });
}
