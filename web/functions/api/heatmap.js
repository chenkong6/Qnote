import { getBearerToken, json, verifyToken } from './_lib/utils.js';

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

  const result = await env.DB.prepare(
    'SELECT date(created_at) AS date, SUM(weight) AS weight FROM entries WHERE user_id = ? GROUP BY date(created_at) ORDER BY date ASC'
  )
    .bind(user.id)
    .all();

  return json(result.results || []);
}
