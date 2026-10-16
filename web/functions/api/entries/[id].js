import { getBearerToken, json, readJson, verifyToken } from '../_lib/utils.js';

async function requireUser(request, env) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return verifyToken(token, env.JWT_SECRET);
}

export async function onRequest({ request, env, params }) {
  const user = await requireUser(request, env);
  if (!user) {
    return json({ error: '未登录或登录已过期。' }, { status: 401 });
  }

  const entryId = Number(params.id);

  if (!Number.isFinite(entryId)) {
    return json({ error: '记录 ID 无效。' }, { status: 400 });
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM entries WHERE id = ? AND user_id = ?')
      .bind(entryId, user.id)
      .run();

    return new Response(null, { status: 204 });
  }

  if (request.method === 'PATCH') {
    const body = await readJson(request);
    const content = typeof body?.content === 'string' ? body.content.trim() : '';
    const visibility = body?.visibility === 'public' ? 'public' : body?.visibility === 'private' ? 'private' : null;

    if (!content && !visibility) {
      return json({ error: '请输入记录内容。' }, { status: 400 });
    }

    if (content && visibility) {
      await env.DB.prepare('UPDATE entries SET content = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .bind(content, visibility, entryId, user.id)
        .run();
    } else if (content) {
      await env.DB.prepare('UPDATE entries SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .bind(content, entryId, user.id)
        .run();
    } else {
      await env.DB.prepare('UPDATE entries SET visibility = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')
        .bind(visibility, entryId, user.id)
        .run();
    }

    return json({ success: true });
  }

  return json({ error: '不支持该请求方法。' }, { status: 405 });
}
