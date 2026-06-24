// Все REST API роуты AnimeWorld
import { Router } from 'express';
import { query } from './db.js';
import {
  hashPassword, verifyPassword, signToken, getRandomAvatarColor,
  requireAuth, requireAdmin, requireUploadPermission,
  type UserPayload,
} from './auth.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директория для временных файлов
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Функция сжатия видео через FFmpeg
async function compressVideo(inputPath: string, outputPath: string, maxSizeMB: number = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '28',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-fs', `${maxSizeMB * 1024 * 1024}`,
      '-y',
      outputPath
    ];
    
    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';
    
    ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error('[ffmpeg] error:', stderr);
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });
    
    ffmpeg.on('error', (err) => {
      console.error('[ffmpeg] spawn error:', err);
      reject(err);
    });
  });
}

// Утилита для очистки временных файлов
function cleanupTempFiles(files: string[]) {
  files.forEach(f => {
    try {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    } catch {}
  });
}

export const router = Router();

// ================== AUTH ==================
router.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });
    if (username.length < 3) return res.status(400).json({ error: 'Имя пользователя минимум 3 символа' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль минимум 4 символа' });

    const hash = await hashPassword(password);
    const isAdmin = username === 'Morfin';
    const avatarColor = getRandomAvatarColor();

    const r = await query(
      `INSERT INTO users (username, password_hash, avatar_color, is_admin, can_upload)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id, username, avatar_color, is_admin, can_upload, created_at`,
      [username, hash, avatarColor, isAdmin]
    );
    const user = r.rows[0];
    const payload: UserPayload = {
      id: user.id, username: user.username, avatarColor: user.avatar_color,
      isAdmin: user.is_admin, canUpload: user.can_upload,
    };
    const token = signToken(payload);
    res.cookie?.('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: payload, token });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Пользователь уже существует' });
    console.error('[register]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Заполните все поля' });

    const r = await query(
      'SELECT id, username, password_hash, avatar_color, is_admin, can_upload FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Неверный пароль' });

    const payload: UserPayload = {
      id: user.id, username: user.username, avatarColor: user.avatar_color,
      isAdmin: user.is_admin, canUpload: user.can_upload,
    };
    const token = signToken(payload);
    res.cookie?.('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    res.json({ user: payload, token });
  } catch (err: any) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json(req.user);
});

// ================== USERS ==================
router.get('/users/:id', async (req, res) => {
  try {
    const r = await query(
      `SELECT id, username, avatar_color, is_admin, can_upload, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Не найден' });
    const u = r.rows[0];
    res.json({
      id: u.id, username: u.username, avatar_color: u.avatar_color,
      is_admin: u.is_admin, can_upload: u.can_upload, created_at: u.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id/anime', async (req, res) => {
  try {
    const r = await query(
      `SELECT id, title, description, poster_mime, genres, year, age_rating, type, likes_count, dislikes_count, views_count, created_at
       FROM anime WHERE created_by = $1 ORDER BY created_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users/:id/favorites', async (req, res) => {
  try {
    const r = await query(
      `SELECT a.id, a.title, a.description, a.poster_mime, a.genres, a.year, a.age_rating, a.type, a.likes_count, a.dislikes_count, a.views_count, a.created_at
       FROM favorites f JOIN anime a ON a.id = f.anime_id
       WHERE f.user_id = $1 ORDER BY f.added_at DESC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Картинки (бинарные)
router.get('/anime/:id/poster', async (req, res) => {
  try {
    const r = await query('SELECT poster_data, poster_mime FROM anime WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0 || !r.rows[0].poster_data) return res.status(404).end();
    res.setHeader('Content-Type', r.rows[0].poster_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(r.rows[0].poster_data);
  } catch (err: any) {
    res.status(500).end();
  }
});

router.get('/anime/:id/banner', async (req, res) => {
  try {
    const r = await query('SELECT banner_data, banner_mime FROM anime WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0 || !r.rows[0].banner_data) return res.status(404).end();
    res.setHeader('Content-Type', r.rows[0].banner_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(r.rows[0].banner_data);
  } catch (err: any) {
    res.status(500).end();
  }
});

router.get('/seasons/:id/poster', async (req, res) => {
  try {
    const r = await query('SELECT poster_data, poster_mime FROM seasons WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0 || !r.rows[0].poster_data) return res.status(404).end();
    res.setHeader('Content-Type', r.rows[0].poster_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(r.rows[0].poster_data);
  } catch (err: any) {
    res.status(500).end();
  }
});

// ================== ANIME ==================
router.get('/anime', async (req, res) => {
  try {
    const { sort = 'popular', genre } = req.query;
    let orderBy = 'a.views_count DESC, a.created_at DESC';
    if (sort === 'newest') orderBy = 'a.created_at DESC';
    else if (sort === 'rating') orderBy = 'rating DESC NULLS LAST';
    else if (sort === 'title') orderBy = 'LOWER(a.title) ASC';

    let where = '';
    const params: any[] = [];
    if (genre && genre !== 'all') {
      where = `WHERE $1 = ANY(a.genres)`;
      params.push(genre);
    }

    const r = await query(
      `SELECT a.id, a.title, a.description, a.poster_mime, a.genres, a.year, a.age_rating, a.type,
              a.likes_count, a.dislikes_count, a.views_count, a.created_at, a.created_by,
              (SELECT AVG(score)::float FROM ratings WHERE anime_id = a.id) AS rating
       FROM anime a ${where}
       ORDER BY ${orderBy}`,
      params
    );
    res.json(r.rows);
  } catch (err: any) {
    console.error('[anime.list]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/anime/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);
    const r = await query(
      `SELECT a.id, a.title, a.description, a.poster_mime, a.genres, a.year, a.age_rating, a.type,
              a.likes_count, a.dislikes_count, a.views_count, a.created_at
       FROM anime a WHERE LOWER(a.title) LIKE $1 ORDER BY a.views_count DESC LIMIT 50`,
      ['%' + q.toLowerCase() + '%']
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/anime/:id', async (req, res) => {
  try {
    const r = await query(
      `SELECT a.*, (SELECT AVG(score)::float FROM ratings WHERE anime_id = a.id) AS rating
       FROM anime a WHERE a.id = $1`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json(r.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/anime/:id/seasons', async (req, res) => {
  try {
    const r = await query(
      `SELECT s.id, s.anime_id, s.season_number, s.description, s.episodes_count, s.poster_mime,
              (SELECT COUNT(*)::int FROM episodes WHERE season_id = s.id) AS real_episodes_count
       FROM seasons s WHERE s.anime_id = $1 ORDER BY s.season_number ASC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== EPISODES ==================
router.get('/seasons/:id/episodes', async (req, res) => {
  try {
    const r = await query(
      `SELECT id, season_id, anime_id, episode_number, title, description, duration_seconds, voiceovers, subtitles, audio_tracks, quality_sources, views_count, created_at, video_mime, size_bytes
       FROM episodes WHERE season_id = $1 ORDER BY episode_number ASC`,
      [req.params.id]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/episodes/:id', async (req, res) => {
  try {
    const r = await query('SELECT * FROM episodes WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    res.json(r.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Стрим видео (binary)
router.get('/episodes/:id/stream', async (req, res) => {
  try {
    const q = String(req.query.quality || '');
    const r = await query('SELECT * FROM episodes WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).end();
    const ep = r.rows[0];
    let data = ep.video_data;
    let mime = ep.video_mime || 'video/mp4';

    // Если нужно конкретное качество — пробуем достать из quality_sources (data URLs)
    if (q && ep.quality_sources && ep.quality_sources[q]) {
      const dataUrl: string = ep.quality_sources[q];
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mime = match[1];
        data = Buffer.from(match[2], 'base64');
      }
    }

    if (!data) return res.status(404).end();

    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(data.length || (data as any).length));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(data);
  } catch (err: any) {
    console.error('[stream]', err.message);
    res.status(500).end();
  }
});

router.post('/episodes/:id/view', async (req, res) => {
  try {
    if (!req.user) return res.json({ ok: true });
    await query(
      `INSERT INTO views (user_id, episode_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, req.params.id]
    );
    await query('UPDATE episodes SET views_count = views_count + 1 WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== COMMENTS ==================
router.get('/anime/:id/comments', async (req, res) => {
  try {
    const r = await query(
      `SELECT c.*, u.username, u.avatar_color, u.is_admin,
              (SELECT COUNT(*)::int FROM comment_likes WHERE comment_id = c.id) AS likes,
              EXISTS(SELECT 1 FROM comment_likes WHERE comment_id = c.id AND user_id = $2) AS liked_by_me
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.anime_id = $1 ORDER BY c.created_at DESC`,
      [req.params.id, req.user?.id ?? -1]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anime/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text?.trim()) return res.status(400).json({ error: 'Пустой комментарий' });
    const r = await query(
      `INSERT INTO comments (anime_id, user_id, text) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user!.id, text.trim()]
    );
    res.json(r.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    const r = await query('SELECT user_id FROM comments WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Не найдено' });
    if (r.rows[0].user_id !== req.user!.id && !req.user!.isAdmin) {
      return res.status(403).json({ error: 'Нет прав' });
    }
    await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/comments/:id/like', requireAuth, async (req, res) => {
  try {
    await query(
      `INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user!.id, req.params.id]
    );
    const r = await query(
      `SELECT COUNT(*)::int AS likes FROM comment_likes WHERE comment_id = $1`,
      [req.params.id]
    );
    res.json({ likes: r.rows[0].likes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== VOTES (likes/dislikes) ==================
router.get('/anime/:id/votes', async (req, res) => {
  try {
    const r = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM anime_votes WHERE anime_id = $1 AND vote = 1) AS likes,
         (SELECT COUNT(*)::int FROM anime_votes WHERE anime_id = $1 AND vote = -1) AS dislikes`,
      [req.params.id]
    );
    let user_vote = 0;
    if (req.user) {
      const ur = await query(
        `SELECT vote FROM anime_votes WHERE anime_id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      user_vote = ur.rows[0]?.vote || 0;
    }
    res.json({ ...r.rows[0], user_vote });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anime/:id/vote', requireAuth, async (req, res) => {
  try {
    const { vote } = req.body || {};
    if (![1, -1, 0].includes(vote)) return res.status(400).json({ error: 'Неверный голос' });

    // Получаем текущий vote
    const cur = await query(
      `SELECT vote FROM anime_votes WHERE anime_id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    const prev = cur.rows[0]?.vote || 0;

    // Обновляем счётчики
    if (prev === 1) await query('UPDATE anime SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [req.params.id]);
    if (prev === -1) await query('UPDATE anime SET dislikes_count = GREATEST(0, dislikes_count - 1) WHERE id = $1', [req.params.id]);
    if (vote === 1) await query('UPDATE anime SET likes_count = likes_count + 1 WHERE id = $1', [req.params.id]);
    if (vote === -1) await query('UPDATE anime SET dislikes_count = dislikes_count + 1 WHERE id = $1', [req.params.id]);

    if (vote === 0) {
      await query('DELETE FROM anime_votes WHERE anime_id = $1 AND user_id = $2', [req.params.id, req.user!.id]);
    } else {
      await query(
        `INSERT INTO anime_votes (anime_id, user_id, vote) VALUES ($1, $2, $3)
         ON CONFLICT (anime_id, user_id) DO UPDATE SET vote = $3, updated_at = NOW()`,
        [req.params.id, req.user!.id, vote]
      );
    }

    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== RATINGS ==================
router.get('/anime/:id/rating', async (req, res) => {
  try {
    const r = await query(
      `SELECT AVG(score)::float AS avg, COUNT(*)::int AS count FROM ratings WHERE anime_id = $1`,
      [req.params.id]
    );
    let user_score: number | null = null;
    if (req.user) {
      const ur = await query(
        `SELECT score FROM ratings WHERE anime_id = $1 AND user_id = $2`,
        [req.params.id, req.user.id]
      );
      user_score = ur.rows[0]?.score ?? null;
    }
    res.json({ avg: r.rows[0].avg || 0, count: r.rows[0].count, user_score });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anime/:id/rate', requireAuth, async (req, res) => {
  try {
    const { score } = req.body || {};
    const v = Math.max(1, Math.min(10, parseInt(score)));
    if (!v) return res.status(400).json({ error: 'Неверная оценка' });
    await query(
      `INSERT INTO ratings (user_id, anime_id, score) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, anime_id) DO UPDATE SET score = $3, updated_at = NOW()`,
      [req.user!.id, req.params.id, v]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== FAVORITES ==================
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT a.* FROM favorites f JOIN anime a ON a.id = f.anime_id WHERE f.user_id = $1 ORDER BY f.added_at DESC`,
      [req.user!.id]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/anime/:id/favorite', requireAuth, async (req, res) => {
  try {
    await query(
      `INSERT INTO favorites (user_id, anime_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user!.id, req.params.id]
    );
    res.json({ ok: true, favorited: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/anime/:id/favorite', requireAuth, async (req, res) => {
  try {
    await query('DELETE FROM favorites WHERE user_id = $1 AND anime_id = $2', [req.user!.id, req.params.id]);
    res.json({ ok: true, favorited: false });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/anime/:id/is-favorite', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT 1 FROM favorites WHERE user_id = $1 AND anime_id = $2`,
      [req.user!.id, req.params.id]
    );
    res.json({ favorite: r.rows.length > 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== HISTORY ==================
router.post('/episodes/:id/history', requireAuth, async (req, res) => {
  try {
    await query(
      `INSERT INTO history (user_id, episode_id) VALUES ($1, $2)`,
      [req.user!.id, req.params.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', requireAuth, async (req, res) => {
  try {
    const r = await query(
      `SELECT DISTINCT ON (h.episode_id)
              h.id, h.watched_at, e.id AS episode_id, e.episode_number, e.title AS episode_title,
              a.id AS anime_id, a.title AS anime_title, a.poster_mime, a.type
       FROM history h
       JOIN episodes e ON e.id = h.episode_id
       JOIN anime a ON a.id = e.anime_id
       WHERE h.user_id = $1
       ORDER BY h.episode_id, h.watched_at DESC
       LIMIT 30`,
      [req.user!.id]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== ADMIN ==================
router.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    let where = '';
    const params: any[] = [];
    if (search) {
      const s = String(search).toLowerCase();
      if (/^\d+$/.test(s)) {
        where = 'WHERE id = $1';
        params.push(parseInt(s));
      } else {
        where = 'WHERE LOWER(username) LIKE $1';
        params.push('%' + s + '%');
      }
    }
    const r = await query(
      `SELECT id, username, avatar_color, is_admin, can_upload, created_at FROM users ${where} ORDER BY id ASC`,
      params
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { is_admin, can_upload } = req.body || {};
    await query(
      `UPDATE users SET is_admin = COALESCE($1, is_admin), can_upload = COALESCE($2, can_upload) WHERE id = $3`,
      [is_admin ?? null, can_upload ?? null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/anime/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM anime WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/seasons/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM seasons WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/episodes/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM episodes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin/comments/:id', requireAdmin, async (req, res) => {
  try {
    await query('DELETE FROM comments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/anime', requireAdmin, async (req, res) => {
  try {
    const r = await query(
      `SELECT a.id, a.title, a.type, a.year, a.created_at, u.username AS author,
              (SELECT COUNT(*)::int FROM seasons WHERE anime_id = a.id) AS seasons_count,
              (SELECT COUNT(*)::int FROM episodes WHERE anime_id = a.id) AS episodes_count
       FROM anime a LEFT JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC`
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ================== UPLOAD (новый endpoint с сжатием на сервере) ==================
// Принимает base64 видео, сжимает через FFmpeg, сохраняет
router.post('/upload/video', requireUploadPermission, async (req, res) => {
  const tempFiles: string[] = [];
  
  try {
    const { video_data, video_mime = 'video/mp4', title, description, year, age_rating, genres, type, season_id, episode_number } = req.body || {};
    
    if (!video_data) return res.status(400).json({ error: 'Видео не указано' });
    
    // Декодируем base64 во временный файл
    const buffer = Buffer.from(video_data, 'base64');
    const tempPath = path.join(uploadDir, `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    fs.writeFileSync(tempPath, buffer);
    tempFiles.push(tempPath);
    
    const maxSizeMB = 500;
    const compressedPath = path.join(uploadDir, `compressed-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`);
    tempFiles.push(compressedPath);
    
    // Сжимаем видео через FFmpeg
    await compressVideo(tempPath, compressedPath, maxSizeMB);
    
    // Читаем сжатое видео
    const compressedData = fs.readFileSync(compressedPath);
    const compressedBase64 = compressedData.toString('base64');
    const compressedSize = compressedData.length;
    
    // Создаём anime если нужно
    let animeId: number | undefined;
    
    if (title) {
      const poster_data = req.body.poster_data || '';
      const poster_mime = req.body.poster_mime || 'image/jpeg';
      
      const r = await query(
        `INSERT INTO anime (title, description, poster_data, poster_mime, banner_data, banner_mime, genres, year, age_rating, type, voiceovers, subtitles, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        [title, description || '', poster_data || null, poster_mime || null, poster_data || null, poster_mime || null, genres || [], year || new Date().getFullYear(), age_rating || '12+', type || 'single', [], [], req.user!.id]
      );
      animeId = r.rows[0].id;
      
      // Создаём сезон
      await query(
        `INSERT INTO seasons (anime_id, season_number, description) VALUES ($1, 1, $2)`,
        [animeId, description || 'Одиночное аниме']
      );
    }
    
    // Определяем season_id
    let sid = season_id ? parseInt(season_id) : null;
    let epNum = episode_number ? parseInt(episode_number) : 1;
    
    if (!sid && animeId) {
      const sr = await query('SELECT id FROM seasons WHERE anime_id = $1 ORDER BY season_number ASC LIMIT 1', [animeId]);
      if (sr.rows[0]) sid = sr.rows[0].id;
    }
    
    if (!sid) {
      cleanupTempFiles(tempFiles);
      return res.status(400).json({ error: 'Не указан season_id' });
    }
    
    // Получаем anime_id из season
    const sr = await query('SELECT anime_id FROM seasons WHERE id = $1', [sid]);
    if (sr.rows.length === 0) {
      cleanupTempFiles(tempFiles);
      return res.status(400).json({ error: 'Сезон не найден' });
    }
    animeId = sr.rows[0].anime_id;
    
    const audioTracks = req.body.audio_tracks ? JSON.parse(req.body.audio_tracks) : [];
    const qualitySources = req.body.quality_sources ? JSON.parse(req.body.quality_sources) : {};
    
    const r = await query(
      `INSERT INTO episodes (season_id, anime_id, episode_number, title, description, video_data, video_mime, duration_seconds, size_bytes, voiceovers, subtitles, audio_tracks, quality_sources)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [sid, animeId, epNum, title || '', '', `data:${video_mime};base64,${compressedBase64}`, video_mime, 0, compressedSize, [], [], JSON.stringify(audioTracks), JSON.stringify(qualitySources)]
    );
    
    // Обновляем episodes_count
    await query(
      `UPDATE seasons SET episodes_count = (SELECT COUNT(*) FROM episodes WHERE season_id = $1) WHERE id = $1`,
      [sid]
    );
    
    cleanupTempFiles(tempFiles);
    res.json({ ok: true, episode_id: r.rows[0].id, anime_id: animeId });
  } catch (err: any) {
    cleanupTempFiles(tempFiles);
    console.error('[upload.video]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint для загрузки баннера
router.post('/upload/banner', requireUploadPermission, async (req, res) => {
  try {
    const { banner_data, banner_mime = 'image/jpeg', anime_id } = req.body || {};
    
    if (!banner_data) return res.status(400).json({ error: 'Баннер не загружен' });
    if (!anime_id) return res.status(400).json({ error: 'Не указан anime_id' });
    
    await query(
      `UPDATE anime SET banner_data = $1, banner_mime = $2 WHERE id = $3`,
      [banner_data, banner_mime, parseInt(anime_id)]
    );
    
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[upload.banner]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ================== UPLOAD (anime + season + episode) ==================
router.post('/upload/anime', requireUploadPermission, async (req, res) => {
  try {
    const {
      title, description, poster_data, poster_mime, banner_data, banner_mime,
      genres = [], year = 2024, age_rating = '12+', type = 'season',
      voiceovers = [], subtitles = [],
    } = req.body || {};

    if (!title?.trim()) return res.status(400).json({ error: 'Введите название' });

    const r = await query(
      `INSERT INTO anime (title, description, poster_data, poster_mime, banner_data, banner_mime, genres, year, age_rating, type, voiceovers, subtitles, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        title.trim(), description || '', poster_data || null, poster_mime || null,
        banner_data || poster_data || null, banner_mime || poster_mime || null,
        genres, year, age_rating, type, voiceovers, subtitles, req.user!.id,
      ]
    );
    const animeId = r.rows[0].id;

    // Если сезонное — создаём первый сезон
    if (type === 'season') {
      await query(
        `INSERT INTO seasons (anime_id, season_number) VALUES ($1, 1) ON CONFLICT DO NOTHING`,
        [animeId]
      );
    } else if (type === 'single') {
      // Сразу создаём сезон 1 для одиночного
      await query(
        `INSERT INTO seasons (anime_id, season_number, description) VALUES ($1, 1, $2)`,
        [animeId, description || 'Одиночное аниме']
      );
    }

    res.json({ ok: true, anime_id: animeId });
  } catch (err: any) {
    console.error('[upload.anime]', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload/season', requireUploadPermission, async (req, res) => {
  try {
    const { anime_id, season_number = 1, description = '', poster_data, poster_mime } = req.body || {};
    if (!anime_id) return res.status(400).json({ error: 'Не указан anime_id' });
    const r = await query(
      `INSERT INTO seasons (anime_id, season_number, description, poster_data, poster_mime)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [anime_id, season_number, description, poster_data || null, poster_mime || null]
    );
    res.json({ ok: true, season_id: r.rows[0].id });
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Такой сезон уже существует' });
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload/episode', requireUploadPermission, async (req, res) => {
  try {
    const {
      season_id, episode_number = 1, title = '', description = '',
      video_data, video_mime = 'video/mp4', duration_seconds = 0, size_bytes = 0,
      voiceovers = [], subtitles = [], audio_tracks = [], quality_sources = {},
    } = req.body || {};

    if (!season_id) return res.status(400).json({ error: 'Не указан season_id' });
    if (!video_data) return res.status(400).json({ error: 'Не указано видео' });

    const sr = await query('SELECT anime_id FROM seasons WHERE id = $1', [season_id]);
    if (sr.rows.length === 0) return res.status(400).json({ error: 'Сезон не найден' });
    const anime_id = sr.rows[0].anime_id;

    const r = await query(
      `INSERT INTO episodes (season_id, anime_id, episode_number, title, description, video_data, video_mime, duration_seconds, size_bytes, voiceovers, subtitles, audio_tracks, quality_sources)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
      [season_id, anime_id, episode_number, title, description, video_data, video_mime, duration_seconds, size_bytes, voiceovers, subtitles, JSON.stringify(audio_tracks), JSON.stringify(quality_sources)]
    );
    const episodeId = r.rows[0].id;

    // Обновляем episodes_count
    await query(
      `UPDATE seasons SET episodes_count = (SELECT COUNT(*) FROM episodes WHERE season_id = $1) WHERE id = $1`,
      [season_id]
    );

    // Обновляем view_count аниме (хотя бы 1)
    await query('UPDATE anime SET views_count = views_count + 0 WHERE id = $1', [anime_id]);

    res.json({ ok: true, episode_id: episodeId, anime_id });
  } catch (err: any) {
    console.error('[upload.episode]', err.message);
    if (err.code === '23505') return res.status(409).json({ error: 'Такая серия уже существует' });
    res.status(500).json({ error: err.message });
  }
});

// ================== OG META (для SSR / Discord preview) ==================
router.get('/og', async (req, res) => {
  try {
    const path = String(req.query.path || '/');
    let title = 'AnimeWorld — Аниме онлайн';
    let description = 'Смотри аниме онлайн бесплатно в хорошем качестве';
    let image = '';

    const animeMatch = path.match(/\/(?:anime|id)(\d+)/) || path.match(/\/id(\d+)/);
    if (animeMatch) {
      const r = await query('SELECT title, description FROM anime WHERE id = $1', [animeMatch[1]]);
      if (r.rows[0]) {
        title = r.rows[0].title;
        description = r.rows[0].description?.slice(0, 200) ?? description;
      }
    }

    res.json({ title, description, image });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});