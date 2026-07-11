import bcrypt from 'bcryptjs';
import { first, all, run, json, authenticate, signJwt } from '../utils/d1.js';

export async function authRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';

  if (method === 'POST' && segment === 'login') {
    const body = await request.json().catch(() => ({}));
    const { username, password } = body;

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, 400);
    }

    const user = await first(db, 'SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
    if (!user) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return json({ error: 'Invalid credentials' }, 401);
    }

    const token = await signJwt(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      env.JWT_SECRET || 'hauzral-pharmacy-pos-secret-key-2024',
      604800
    );

    const { password: _pw, ...safeUser } = user;
    return json({ token, user: safeUser });
  }

  if (method === 'POST' && segment === 'register') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (authUser.role !== 'admin' && authUser.role !== 'manager') {
      return json({ error: 'Insufficient permissions' }, 403);
    }

    const body = await request.json().catch(() => ({}));
    const { username, password: rawPassword, full_name, role, email, phone } = body;

    if (!username || !rawPassword || !full_name) {
      return json({ error: 'Username, password, and full_name are required' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return json({ error: 'Username already exists' }, 409);
    }

    const hashedPassword = bcrypt.hashSync(rawPassword, 10);
    const now = new Date().toISOString();

    const info = await run(
      db,
      'INSERT INTO users (username, password, full_name, role, email, phone, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [username, hashedPassword, full_name, role || 'cashier', email || null, phone || null, now]
    );

    const newUser = await first(db, 'SELECT id, username, full_name, role, email, phone, is_active, created_at FROM users WHERE id = ?', [info.lastInsertRowid]);
    return json(newUser, 201);
  }

  if (method === 'GET' && segment === 'me') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const user = await first(
      db,
      'SELECT id, username, full_name, role, email, phone, avatar, is_active, two_factor_enabled, created_at FROM users WHERE id = ?',
      [authUser.id]
    );
    if (!user) {
      return json({ error: 'User not found' }, 404);
    }
    return json(user);
  }

  if (method === 'GET' && segment === 'users') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const users = await all(db, 'SELECT id, username, full_name, role, email, phone, avatar, is_active, two_factor_enabled, created_at FROM users ORDER BY created_at DESC');
    return json(users);
  }

  if (method === 'PUT' && segment === 'users') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parts[1] ? parseInt(parts[1]) : null;
    if (!id) {
      return json({ error: 'User ID is required' }, 400);
    }

    const body = await request.json().catch(() => ({}));
    const { full_name, role, email, phone, is_active, password: rawPassword, avatar } = body;

    const existing = await first(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'User not found' }, 404);
    }

    const now = new Date().toISOString();

    if (rawPassword) {
      const hashedPassword = bcrypt.hashSync(rawPassword, 10);
      await run(db, `UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar), is_active = COALESCE(?, is_active), password = ?, updated_at = ? WHERE id = ?`,
        [full_name, role, email, phone, avatar, is_active !== undefined ? (is_active ? 1 : 0) : null, hashedPassword, now, id]);
    } else {
      await run(db, `UPDATE users SET full_name = COALESCE(?, full_name), role = COALESCE(?, role), email = COALESCE(?, email), phone = COALESCE(?, phone), avatar = COALESCE(?, avatar), is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?`,
        [full_name, role, email, phone, avatar, is_active !== undefined ? (is_active ? 1 : 0) : null, now, id]);
    }

    const updated = await first(db, 'SELECT id, username, full_name, role, email, phone, avatar, is_active, two_factor_enabled, created_at FROM users WHERE id = ?', [id]);
    return json(updated);
  }

  if (method === 'DELETE' && segment === 'users') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parts[1] ? parseInt(parts[1]) : null;
    if (!id) {
      return json({ error: 'User ID is required' }, 400);
    }

    if (id === authUser.id) {
      return json({ error: 'Cannot deactivate yourself' }, 400);
    }

    const existing = await first(db, 'SELECT id FROM users WHERE id = ?', [id]);
    if (!existing) {
      return json({ error: 'User not found' }, 404);
    }

    await run(db, 'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    return json({ message: 'User deactivated' });
  }

  return json({ error: 'Not found' }, 404);
}
