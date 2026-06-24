// Все REST API роуты AnimeWorld
import { Router } from 'express';
import { query } from './db.js';
import {
  hashPassword, verifyPassword, signToken, getRandomAvatarColor,
  requireAuth, requireAdmin, requireUploadPermission,
  type UserPayload,
} from './auth.js';

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
      `SELECT id, username, password_hash, avatar_color, is_admin, can_upload FROM users WHERE username = $1`,
      [username]
    );
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: 'Неверные данные' });
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Неверные данные' });

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

router.post('/auth/logout', (_req, res) => {
  res.clearCookie?.('token');
  res.json({ ok: true });
});

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ================== ANIME ==================
router.get('/anime', async (req, res) => {
  try {
    const sort = req.query.sort as string || 'popular';
    const genre = req.query.genre as string;
    let sql = `
      SELECT a.*,
        COALESCE(COUNT(DISTINCT v.id), 0) as viewsCount,
        COALESCE(COUNT(DISTINCT ep.id), 0) as episodesCount,
        COALESCE(SUM(CASE WHEN uv.vote = 1 THEN 1 ELSE 0 END), 0) as likesCount,
        COALESCE(SUM(CASE WHEN uv.vote = -1 THEN 1 ELSE 0 END), 0) as dislikesCount,
        COALESCE(AVG(r.score), 0) as rating,
        COALESCE(COUNT(r.id), 0) as ratingCount
      FROM anime a
      LEFT JOIN seasons s ON s.anime_id = a.id
      LEFT JOIN episodes ep ON ep.season_id = s.id
      LEFT JOIN views v ON v.episode_id = ep.id
      LEFT JOIN user_votes uv ON uv.anime_id = a.id
      LEFT JOIN ratings r ON r.anime_id = a.id
    `;
    const params = [];
    
    if (genre && genre !== 'all') {
      sql += ` WHERE a.genres @> $${params.length + 1}::text[]`;
      params.push(`{${genre}}`);
    }
    
    sql += ` GROUP BY a.id`;
    
    if (sort === 'popular') sql += ' ORDER BY a.created_at DESC';
    else if (sort === 'top') sql += ' ORDER BY COALESCE(AVG(r.score), 0) DESC NULLS LAST, a.created_at DESC';
    else if (sort === 'new') sql += ' ORDER BY a.created_at DESC';
    else sql += ' ORDER BY a.title ASC';
    
    const { rows } = await query(sql, params);
    const items = rows.map(r => ({
      id: r.id,
      title: r.title,
      description: r.description || '',
      year: r.year,
      ageRating: r.age_rating || '12+',
      genres: Array.isArray(r.genres) ? r.genres : [r.genres || 'Неизвестно'],
      viewsCount: Number(r.viewscount),
      episodesCount: Number(r.episodescount),
      likesCount: Number(r.likescount),
      dislikesCount: Number(r.dislikescount),
      rating: Number(r.rating) || 0,
      ratingCount: Number(r.ratingcount) || 0,
      createdAt: r.created_at,
    }));
    res.json({ items });
  } catch (err: any) {
    console.error('[anime list]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/anime/:id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.*,
        COALESCE(COUNT(DISTINCT v.id), 0) as viewsCount,
        COALESCE(COUNT(DISTINCT ep.id), 0) as episodesCount,
        COALESCE(SUM(CASE WHEN uv.vote = 1 THEN 1 ELSE 0 END), 0) as likesCount,
        COALESCE(SUM(CASE WHEN uv.vote = -1 THEN 1 ELSE 0 END), 0) as dislikesCount,
        COALESCE(AVG(r.score), 0) as rating,
        COALESCE(COUNT(r.id), 0) as ratingCount
       FROM anime a
       LEFT JOIN seasons s ON s.anime_id = a.id
       LEFT JOIN episodes ep ON ep.season_id = s.id
       LEFT JOIN views v ON v.episode_id = ep.id
       LEFT JOIN user_votes uv ON uv.anime_id = a.id
       LEFT JOIN ratings r ON r.anime_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [req.params.id]
    );
    const r = rows[0];
    if (!r) return res.status(404).json({ error: 'Не найдено' });
    
    const anime = {
      id: r.id,
      title: r.title,
      description: r.description || '',
      year: r.year,
      ageRating: r.age_rating || '12+',
      genres: Array.isArray(r.genres) ? r.genres : [r.genres || 'Неизвестно'],
      viewsCount: Number(r.viewscount),
      episodesCount: Number(r.episodescount),
      likesCount: Number(r.likescount),
      dislikesCount: Number(r.dislikescount),
      rating: Number(r.rating) || 0,
      ratingCount: Number(r.ratingcount) || 0,
      createdAt: r.created_at,
    };
    res.json({ anime });
  } catch (err: any) {
    console.error('[anime detail]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание нового аниме (без файлов)
router.post('/anime', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const { title, description, year, ageRating, genres } = req.body;
    if (!title) return res.status(400).json({ error: 'Название обязательно' });

    // Преобразование жанров в массив
    const genresArray = genres 
      ? genres.split(',').map((g: string) => g.trim()).filter(Boolean)
      : ['Неизвестно'];

    const { rows } = await query(
      `INSERT INTO anime (title, description, year, age_rating, genres, author_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [title, description || '', Number(year) || new Date().getFullYear(), 
       ageRating || '12+', genresArray, req.user?.id]
    );

    res.json({ animeId: rows[0].id });
  } catch (err: any) {
    console.error('[create anime]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== SEASONS ==================
router.post('/anime/:id/seasons', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const animeId = Number(req.params.id);
    const { seasonNumber, description } = req.body;
    
    const { rows } = await query(
      `INSERT INTO seasons (anime_id, season_number, description)
       VALUES ($1, $2, $3) RETURNING id`,
      [animeId, Number(seasonNumber), description || '']
    );

    res.json({ seasonId: rows[0].id });
  } catch (err: any) {
    console.error('[create season]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/seasons/:id/episodes', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM episodes WHERE season_id = $1 ORDER BY episode_number`,
      [req.params.id]
    );
    const episodes = rows.map(r => ({
      id: r.id,
      seasonId: r.season_id,
      episodeNumber: r.episode_number,
      title: r.title || `Эпизод ${r.episode_number}`,
      durationSeconds: r.duration_seconds || 0,
      createdAt: r.created_at,
    }));
    res.json({ episodes });
  } catch (err: any) {
    console.error('[season episodes]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== EPISODES ==================
router.post('/seasons/:id/episodes', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const seasonId = Number(req.params.id);
    const { episodeNumber, title } = req.body;
    
    const { rows } = await query(
      `INSERT INTO episodes (season_id, episode_number, title)
       VALUES ($1, $2, $3) RETURNING id`,
      [seasonId, Number(episodeNumber), title || `Эпизод ${episodeNumber}`]
    );

    res.json({ episodeId: rows[0].id });
  } catch (err: any) {
    console.error('[upload episode]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== COMMENTS ==================
router.get('/anime/:id/comments', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT c.*, u.username, u.avatar_color
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.anime_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    const comments = rows.map(r => ({
      id: r.id,
      animeId: r.anime_id,
      userId: r.user_id,
      episodeId: r.episode_id,
      username: r.username,
      avatarColor: r.avatar_color,
      text: r.text,
      likes: r.likes || 0,
      likedByMe: false,
      createdAt: r.created_at,
    }));
    res.json({ comments });
  } catch (err: any) {
    console.error('[comments list]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/anime/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text, episodeId } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Комментарий не может быть пустым' });

    const { rows } = await query(
      `INSERT INTO comments (anime_id, user_id, episode_id, text)
       VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
      [req.params.id, req.user?.id, episodeId || null, text.trim()]
    );

    res.json({ 
      comment: {
        id: rows[0].id,
        animeId: Number(req.params.id),
        userId: req.user?.id,
        episodeId: episodeId || null,
        username: req.user?.username,
        avatarColor: req.user?.avatarColor,
        text: text.trim(),
        likes: 0,
        likedByMe: false,
        createdAt: rows[0].created_at,
      }
    });
  } catch (err: any) {
    console.error('[add comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== VOTES ==================
router.get('/anime/:id/votes', requireAuth, async (req, res) => {
  try {
    const [votesRes, userVoteRes] = await Promise.all([
      query(
        `SELECT 
          COUNT(*) FILTER (WHERE vote = 1) as likes,
          COUNT(*) FILTER (WHERE vote = -1) as dislikes
         FROM user_votes WHERE anime_id = $1`,
        [req.params.id]
      ),
      query(
        `SELECT vote FROM user_votes WHERE anime_id = $1 AND user_id = $2`,
        [req.params.id, req.user?.id]
      )
    ]);

    res.json({
      likes: Number(votesRes.rows[0]?.likes || 0),
      dislikes: Number(votesRes.rows[0]?.dislikes || 0),
      userVote: userVoteRes.rows[0]?.vote || 0,
    });
  } catch (err: any) {
    console.error('[votes]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/anime/:id/vote', requireAuth, async (req, res) => {
  try {
    const { vote } = req.body;
    const validVote = vote === 1 || vote === -1 || vote === 0;
    if (!validVote) return res.status(400).json({ error: 'Неверное значение голоса' });

    await query(
      `DELETE FROM user_votes WHERE anime_id = $1 AND user_id = $2`,
      [req.params.id, req.user?.id]
    );

    if (vote !== 0) {
      await query(
        `INSERT INTO user_votes (anime_id, user_id, vote) VALUES ($1, $2, $3)`,
        [req.params.id, req.user?.id, vote]
      );
    }

    const votesRes = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE vote = 1) as likes,
        COUNT(*) FILTER (WHERE vote = -1) as dislikes
       FROM user_votes WHERE anime_id = $1`,
      [req.params.id]
    );

    res.json({
      likes: Number(votesRes.rows[0]?.likes || 0),
      dislikes: Number(votesRes.rows[0]?.dislikes || 0),
      userVote: vote,
    });
  } catch (err: any) {
    console.error('[vote]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== RATINGS ==================
router.get('/anime/:id/rating', requireAuth, async (req, res) => {
  try {
    const [ratingRes, userScoreRes] = await Promise.all([
      query(
        `SELECT 
          COALESCE(AVG(score), 0) as average,
          COUNT(*) as count
         FROM ratings WHERE anime_id = $1`,
        [req.params.id]
      ),
      query(
        `SELECT score FROM ratings WHERE anime_id = $1 AND user_id = $2`,
        [req.params.id, req.user?.id]
      )
    ]);

    res.json({
      average: Number(ratingRes.rows[0]?.average || 0),
      count: Number(ratingRes.rows[0]?.count || 0),
      userScore: userScoreRes.rows[0]?.score || null,
    });
  } catch (err: any) {
    console.error('[rating]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/anime/:id/rate', requireAuth, async (req, res) => {
  try {
    const { score } = req.body;
    const numScore = Number(score);
    if (numScore < 1 || numScore > 10) return res.status(400).json({ error: 'Оценка должна быть от 1 до 10' });

    await query(
      `DELETE FROM ratings WHERE anime_id = $1 AND user_id = $2`,
      [req.params.id, req.user?.id]
    );

    await query(
      `INSERT INTO ratings (anime_id, user_id, score) VALUES ($1, $2, $3)`,
      [req.params.id, req.user?.id, numScore]
    );

    const ratingRes = await query(
      `SELECT 
        COALESCE(AVG(score), 0) as average,
        COUNT(*) as count
       FROM ratings WHERE anime_id = $1`,
      [req.params.id]
    );

    res.json({
      average: Number(ratingRes.rows[0]?.average || 0),
      count: Number(ratingRes.rows[0]?.count || 0),
      userScore: numScore,
    });
  } catch (err: any) {
    console.error('[rate]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== FAVORITES ==================
router.get('/favorites', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT a.id, a.title, a.year
       FROM favorites f
       JOIN anime a ON a.id = f.anime_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user?.id]
    );
    res.json({ items: rows });
  } catch (err: any) {
    console.error('[favorites]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/favorites/:id', requireAuth, async (req, res) => {
  try {
    const animeId = Number(req.params.id);
    const existing = await query(
      `SELECT id FROM favorites WHERE user_id = $1 AND anime_id = $2`,
      [req.user?.id, animeId]
    );

    if (existing.rows.length > 0) {
      await query(
        `DELETE FROM favorites WHERE user_id = $1 AND anime_id = $2`,
        [req.user?.id, animeId]
      );
      res.json({ favorite: false });
    } else {
      await query(
        `INSERT INTO favorites (user_id, anime_id) VALUES ($1, $2)`,
        [req.user?.id, animeId]
      );
      res.json({ favorite: true });
    }
  } catch (err: any) {
    console.error('[toggle favorite]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== HISTORY ==================
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT v.*, e.title as episode_title, a.title as anime_title
       FROM views v
       JOIN episodes e ON e.id = v.episode_id
       JOIN seasons s ON s.id = e.season_id
       JOIN anime a ON a.id = s.anime_id
       WHERE v.user_id = $1
       ORDER BY v.last_watched DESC
       LIMIT 50`,
      [req.user?.id]
    );
    res.json({ history: rows });
  } catch (err: any) {
    console.error('[history]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/history/:id', requireAuth, async (req, res) => {
  try {
    const { watchedSeconds } = req.body;
    await query(
      `INSERT INTO views (user_id, episode_id, last_watched, watched_seconds)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (user_id, episode_id) DO UPDATE
       SET last_watched = NOW(), watched_seconds = $3`,
      [req.user?.id, req.params.id, Number(watchedSeconds) || 0]
    );
    const countRes = await query(
      `SELECT COUNT(*) as views FROM views WHERE episode_id = $1`,
      [req.params.id]
    );
    res.json({ views: Number(countRes.rows[0]?.views || 0), counted: true });
  } catch (err: any) {
    console.error('[record view]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== ADMIN ==================
router.get('/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, avatar_color, is_admin, can_upload, created_at FROM users ORDER BY id DESC`
    );
    res.json({ users: rows });
  } catch (err: any) {
    console.error('[admin users]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/admin/users/:id/upload-permission', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { canUpload } = req.body;
    await query(
      `UPDATE users SET can_upload = $1 WHERE id = $2`,
      [Boolean(canUpload), req.params.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[admin upload permission]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/admin/users/:id/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { isAdmin } = req.body;
    await query(
      `UPDATE users SET is_admin = $1 WHERE id = $2`,
      [Boolean(isAdmin), req.params.id]
    );
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[admin set admin]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/admin/comments/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await query(`DELETE FROM comments WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[admin delete comment]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.delete('/admin/anime/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Удаляем аниме из БД (все связанные данные удалятся каскадно)
    await query(`DELETE FROM anime WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[admin delete anime]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== FILE ENDPOINTS ==================

// Получение постера аниме
router.get('/files/anime/:id/poster', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT poster_data, poster_mime FROM anime WHERE id = $1`,
      [req.params.id]
    );
    const anime = rows[0];
    if (!anime || !anime.poster_data) {
      res.status(404).json({ error: 'Постер не найден' });
      return;
    }

    res.setHeader('Content-Type', anime.poster_mime || 'image/jpeg');
    res.send(anime.poster_data);
  } catch (err: any) {
    console.error('[get poster]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение баннера аниме
router.get('/files/anime/:id/banner', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT banner_data, banner_mime FROM anime WHERE id = $1`,
      [req.params.id]
    );
    const anime = rows[0];
    if (!anime || !anime.banner_data) {
      res.status(404).json({ error: 'Баннер не найден' });
      return;
    }

    res.setHeader('Content-Type', anime.banner_mime || 'image/jpeg');
    res.send(anime.banner_data);
  } catch (err: any) {
    console.error('[get banner]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение постера сезона
router.get('/files/season/:id/poster', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT poster_data, poster_mime FROM seasons WHERE id = $1`,
      [req.params.id]
    );
    const season = rows[0];
    if (!season || !season.poster_data) {
      res.status(404).json({ error: 'Постер не найден' });
      return;
    }

    res.setHeader('Content-Type', season.poster_mime || 'image/jpeg');
    res.send(season.poster_data);
  } catch (err: any) {
    console.error('[get season poster]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение видео эпизода
router.get('/files/episode/:id/video', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT video_data, video_mime FROM episodes WHERE id = $1`,
      [req.params.id]
    );
    const episode = rows[0];
    if (!episode || !episode.video_data) {
      res.status(404).json({ error: 'Видео не найдено' });
      return;
    }

    res.setHeader('Content-Type', episode.video_mime || 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.send(episode.video_data);
  } catch (err: any) {
    console.error('[get video]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Загрузка постера для аниме
router.post('/files/anime/:id/poster', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const animeId = req.params.id;
    const { data, mime } = req.body;
    
    if (!data || !mime) {
      return res.status(400).json({ error: 'Данные файла обязательны' });
    }
    
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'Файл должен быть изображением' });
    }

    await query(
      `UPDATE anime SET poster_data = $1, poster_mime = $2 WHERE id = $3`,
      [Buffer.from(data, 'base64'), mime, animeId]
    );

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[upload poster]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Загрузка баннера для аниме
router.post('/files/anime/:id/banner', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const animeId = req.params.id;
    const { data, mime } = req.body;
    
    if (!data || !mime) {
      return res.status(400).json({ error: 'Данные файла обязательны' });
    }
    
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'Файл должен быть изображением' });
    }

    await query(
      `UPDATE anime SET banner_data = $1, banner_mime = $2 WHERE id = $3`,
      [Buffer.from(data, 'base64'), mime, animeId]
    );

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[upload banner]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Загрузка постера для сезона
router.post('/files/season/:id/poster', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const seasonId = req.params.id;
    const { data, mime } = req.body;
    
    if (!data || !mime) {
      return res.status(400).json({ error: 'Данные файла обязательны' });
    }
    
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ error: 'Файл должен быть изображением' });
    }

    await query(
      `UPDATE seasons SET poster_data = $1, poster_mime = $2 WHERE id = $3`,
      [Buffer.from(data, 'base64'), mime, seasonId]
    );

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[upload season poster]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Загрузка видео для эпизода
router.post('/files/episode/:id/video', requireAuth, requireUploadPermission, async (req, res) => {
  try {
    const episodeId = req.params.id;
    const { data, mime, durationSeconds, sizeBytes } = req.body;
    
    if (!data || !mime) {
      return res.status(400).json({ error: 'Данные файла обязательны' });
    }
    
    if (!mime.startsWith('video/')) {
      return res.status(400).json({ error: 'Файл должен быть видео' });
    }

    await query(
      `UPDATE episodes SET video_data = $1, video_mime = $2, duration_seconds = $3, size_bytes = $4 WHERE id = $5`,
      [Buffer.from(data, 'base64'), mime, durationSeconds || 0, sizeBytes || 0, episodeId]
    );

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[upload video]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

export default router;