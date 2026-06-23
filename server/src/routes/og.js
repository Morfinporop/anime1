// OG / SSR — генерация метатегов для ботов соцсетей (Discord, Telegram и т.п.)
import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const path = req.query.path || '/';
    let title = 'AnimeWorld — Аниме онлайн';
    let description = 'Смотри аниме онлайн бесплатно в хорошем качестве';
    let image = '/images/logov.png';

    // /id123 — карточка аниме
    const animeMatch = path.match(/^\/id(\d+)/);
    if (animeMatch) {
      const r = await pool.query('SELECT * FROM anime WHERE id = $1', [animeMatch[1]]);
      if (r.rows[0]) {
        title = r.rows[0].title;
        description = r.rows[0].description;
        image = r.rows[0].poster;
      }
    }

    // /watch/123 — карточка эпизода
    const epMatch = path.match(/^\/watch\/(\d+)/);
    if (epMatch) {
      const r = await pool.query(
        `SELECT e.*, a.title AS anime_title, a.poster FROM episodes e
         JOIN anime a ON a.id = e.anime_id WHERE e.id = $1`,
        [epMatch[1]]
      );
      if (r.rows[0]) {
        title = `${r.rows[0].anime_title} — ${r.rows[0].title}`;
        description = r.rows[0].description;
        image = r.rows[0].poster;
      }
    }

    res.json({ title, description, image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;