import { createToken, hashPassword, json, normalizeEmail, readJson } from '../_lib/utils.js';

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    return json({ error: '请输入邮箱和密码。' }, { status: 400 });
  }

  const passwordHash = await hashPassword(password, env.JWT_SECRET);
  const existingUser = await env.DB.prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first();

  let userId = existingUser?.id;

  if (!existingUser) {
    // Auto-registration is disabled by default for privacy.
    // If a Pages secret `ALLOWED_USERS` exists and contains this email, allow registration.
    const allowed = (env.ALLOWED_USERS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (allowed.length > 0 && allowed.includes(email)) {
      const result = await env.DB.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
        .bind(email, passwordHash)
        .run();
      userId = result.meta.last_row_id;
    } else {
      return json({ error: '暂未开放注册，请联系管理员。' }, { status: 403 });
    }
  } else if (existingUser.password_hash !== passwordHash) {
    return json({ error: '邮箱或密码不正确。' }, { status: 401 });
  }

  const token = await createToken({ id: userId, email }, env.JWT_SECRET);

  return json({
    token,
    user: {
      id: userId,
      email,
    },
  });
}
