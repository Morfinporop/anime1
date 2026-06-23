import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

// Простейшая проверка роли — в реальном приложении используется middleware с JWT
async function requireAdmin(req, res, next) {
  const userId = req.body.user_id || req.query.user_id;
  if (!userId) return res.status(401).json({ error: 'Не авторизован' });
  const r = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
  if (r.rows[0]?.role !== 'admin') return res.status(403).json({ error: 'Требуются права администратора' });
  next();
}

router.post('/anime', requireAdmin, async (req, res) => {
  try {
    const { title, description, poster, type } = req.body || {};
    if (!title || !type) return res.status(400).json({ error: 'Заполните название и тип' });
    if (!['season', 'movie'].includes(type)) return res.status(400).json({ error: 'Неверный тип' });
    const r = await pool.query(
      `INSERT INTO anime (title, description, poster, type) VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, description || '', poster || '', type]
    );
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/episodes', requireAdmin, async (req, res) => {
  try {
    const { anime_id, season, episode_number, title, description, video_url, duration, audio_tracks, qualities } = req.body || {};
    if (!anime_id || !title || !video_url) return res.status(400).json({ error: 'Не хватает данных' });
    const r = await pool.query(
      `INSERT INTO episodes (anime_id, season, episode_number, title, description, video_url, duration, audio_tracks, qualities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb) RETURNING *`,
      [
        anime_id,
        season || 1,
        episode_number || 1,
        title,
        description || '',
        video_url,
        duration || 0,
        JSON.stringify(audio_tracks || []),
        JSON.stringify(qualities || ['720p']),
      ]
    );
    res.json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Такая серия уже существует' });
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;