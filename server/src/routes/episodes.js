import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// Получить эпизод
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM episodes WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Комментарии эпизода
router.get('/:id/comments', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT c.*, u.username, u.id AS uid FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.episode_id = $1 ORDER BY c.created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const { user_id, content } = req.body || {};
    if (!user_id || !content?.trim()) return res.status(400).json({ error: 'Не указан пользователь или текст' });
    const r = await pool.query(
      `INSERT INTO comments (user_id, episode_id, content) VALUES ($1, $2, $3) RETURNING *`,
      [user_id, req.params.id, content.trim()]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Рейтинг
router.get('/:id/rating', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const r = await pool.query(
      'SELECT AVG(value)::float AS avg, COUNT(*)::int AS count FROM ratings WHERE episode_id = $1',
      [req.params.id]
    );
    let userRating;
    if (userId) {
      const ur = await pool.query(
        'SELECT value FROM ratings WHERE episode_id = $1 AND user_id = $2',
        [req.params.id, userId]
      );
      userRating = ur.rows[0]?.value;
    }
    res.json({ avg: r.rows[0].avg || 0, count: r.rows[0].count, userRating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/rating', async (req, res) => {
  try {
    const { user_id, value } = req.body || {};
    if (!user_id || !value) return res.status(400).json({ error: 'Не указан пользователь или оценка' });
    const v = Math.max(1, Math.min(10, parseInt(value)));
    await pool.query(
      `INSERT INTO ratings (user_id, episode_id, value) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, episode_id) DO UPDATE SET value = EXCLUDED.value`,
      [user_id, req.params.id, v]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;