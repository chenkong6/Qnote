import { getBearerToken, json, verifyToken } from '../_lib/utils.js';

async function requireUser(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return verifyToken(token, env.JWT_SECRET);
}

export async function onRequestGet({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: '未登录或登录已过期。' }, { status: 401 });
  }

  const entry = await env.DB.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY RANDOM() LIMIT 1')
    .bind(user.id)
    .first();

  return json(entry || null);
}
