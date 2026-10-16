import { getBearerToken, json, sha256Hex, verifyToken } from '../../_lib/utils.js';

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

  const entry = await env.DB.prepare('SELECT id, content FROM entries WHERE id = ? AND user_id = ?')
    .bind(entryId, user.id)
    .first();

  if (!entry) {
    return json({ error: '记录不存在。' }, { status: 404 });
  }

  const hash = await sha256Hex(`${entry.id}:${entry.content}`);
  return json({ token: `${entry.id}-${hash}`, hash });
}
