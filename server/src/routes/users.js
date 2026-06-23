import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.post('/:id/history', async (req, res) => {
  try {
    const { episode_id } = req.body || {};
    if (!episode_id) return res.status(400).json({ error: 'Не указан эпизод' });
    // remove existing then insert (чтобы история не дублировалась)
    await pool.query(
      'DELETE FROM view_history WHERE user_id = $1 AND episode_id = $2',
      [req.params.id, episode_id]
    );
    await pool.query(
      'INSERT INTO view_history (user_id, episode_id) VALUES ($1, $2)',
      [req.params.id, episode_id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT vh.watched_at, e.*, a.title AS anime_title, a.poster AS anime_poster
       FROM view_history vh
       JOIN episodes e ON e.id = vh.episode_id
       JOIN anime a ON a.id = e.anime_id
       WHERE vh.user_id = $1
       ORDER BY vh.watched_at DESC LIMIT 30`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;