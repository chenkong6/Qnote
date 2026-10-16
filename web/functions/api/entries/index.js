import { calculateWeight, getBearerToken, json, readJson, verifyToken } from '../_lib/utils.js';

async function requireUser(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return verifyToken(token, env.JWT_SECRET);
}

export async function onRequest({ request, env }) {
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: '未登录或登录已过期。' }, { status: 401 });
  }

  if (request.method === 'GET') {
    const result = await env.DB.prepare('SELECT * FROM entries WHERE user_id = ? ORDER BY created_at DESC')
      .bind(user.id)
      .all();

    return json(result.results || []);
  }

  if (request.method === 'POST') {
    const body = await readJson(request);
    const content = typeof body?.content === 'string' ? body.content.trim() : '';

    if (!content) {
      return json({ error: '请输入记录内容。' }, { status: 400 });
    }

    const mood = typeof body?.mood === 'string' && body.mood.trim() ? body.mood.trim() : 'neutral';
    const tags = typeof body?.tags === 'string' ? body.tags : '';
    const source = typeof body?.source === 'string' && body.source.trim() ? body.source.trim() : 'web';
    const weight = calculateWeight(content);

    const insertResult = await env.DB.prepare(
      'INSERT INTO entries (user_id, content, mood, tags, source, weight) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(user.id, content, mood, tags, source, weight)
      .run();

    const entry = await env.DB.prepare('SELECT * FROM entries WHERE id = ?')
      .bind(insertResult.meta.last_row_id)
      .first();

    return json(entry, { status: 201 });
  }

  return json({ error: '不支持该请求方法。' }, { status: 405 });
}
