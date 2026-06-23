import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (username.length < 3) return res.status(400).json({ error: 'Имя пользователя минимум 3 символа' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль минимум 4 символа' });

    const hash = await bcrypt.hash(password, 10);
    const role = username === 'Morfin' ? 'admin' : 'user';

    const result = await pool.query(
      `INSERT INTO users (username, password_hash, role, can_upload)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, can_upload, created_at`,
      [username, hash, role, username === 'Morfin']
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Пользователь уже существует' });
    console.error('[auth/register]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });

    const result = await pool.query(
      'SELECT id, username, password_hash, role, can_upload, created_at FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный пароль' });

    delete user.password_hash;
    res.json(user);
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;