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
import multer from 'multer';
import { extname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Директория для временных файлов
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
  fileFilter: function (req, file, cb) {
    // Разрешаем видео файлы и изображения
    const allowedVideoFormats = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'];
    const allowedImageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const fileExt = extname(file.originalname).toLowerCase();
    
    if (file.fieldname === 'video') {
      if (allowedVideoFormats.includes(fileExt)) {
        cb(null, true);
      } else {
        cb(new Error('Неподдерживаемый формат видео. Разрешены: mp4, avi, mov, mkv, webm, flv'));
      }
    } else if (file.fieldname === 'poster' || file.fieldname === 'banner') {
      if (allowedImageFormats.includes(fileExt)) {
        cb(null, true);
      } else {
        cb(new Error('Неподдерживаемый формат изображения. Разрешены: jpg, jpeg, png, gif, webp'));
      }
    } else {
      cb(null, true);
    }
  }
});

// Проверка доступности FFmpeg
async function checkFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpegCheck = spawn('ffmpeg', ['-version']);
    
    ffmpegCheck.on('close', (code) => {
      resolve(code === 0);
    });
    
    ffmpegCheck.on('error', () => {
      resolve(false);
    });
  });
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

router.post('/auth/logout', (_, res) => {
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
      poster: r.poster || '',
      banner: r.banner || '',
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
      poster: r.poster || '',
      banner: r.banner || '',
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

// Создание нового аниме с загрузкой баннера
router.post('/anime', requireAuth, requireUploadPermission, upload.fields([
  { name: 'poster', maxCount: 1 },
  { name: 'banner', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, description, year, ageRating, genres } = req.body;
    if (!title) return res.status(400).json({ error: 'Название обязательно' });

    // Обработка файлов
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    let posterPath = '';
    let bannerPath = '';

    if (files?.poster?.[0]) {
      const posterFile = files.poster[0];
      posterPath = `/uploads/${posterFile.filename}`;
    }

    if (files?.banner?.[0]) {
      const bannerFile = files.banner[0];
      bannerPath = `/uploads/${bannerFile.filename}`;
    }

    // Преобразование жанров в массив
    const genresArray = genres 
      ? genres.split(',').map((g: string) => g.trim()).filter(Boolean)
      : ['Неизвестно'];

    const { rows } = await query(
      `INSERT INTO anime (title, description, year, age_rating, genres, poster, banner, author_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [title, description || '', Number(year) || new Date().getFullYear(), 
       ageRating || '12+', genresArray, posterPath, bannerPath, req.user?.id]
    );

    res.json({ animeId: rows[0].id });
  } catch (err: any) {
    console.error('[create anime]', err.message);
    cleanupTempFiles([
      (req.files as any)?.poster?.[0]?.path,
      (req.files as any)?.banner?.[0]?.path
    ].filter(Boolean));
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== SEASONS ==================
router.post('/anime/:id/seasons', requireAuth, requireUploadPermission, upload.single('poster'), async (req, res) => {
  try {
    const animeId = Number(req.params.id);
    const { seasonNumber, description } = req.body;
    let posterPath = '';
    
    if (req.file) {
      posterPath = `/uploads/${req.file.filename}`;
    }

    const { rows } = await query(
      `INSERT INTO seasons (anime_id, season_number, description, poster)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [animeId, Number(seasonNumber), description || '', posterPath]
    );

    res.json({ seasonId: rows[0].id });
  } catch (err: any) {
    console.error('[create season]', err.message);
    if (req.file) cleanupTempFiles([req.file.path]);
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
      videoUrl: r.video_url || '',
      poster: r.poster || '',
      createdAt: r.created_at,
    }));
    res.json({ episodes });
  } catch (err: any) {
    console.error('[season episodes]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== EPISODES (загрузка видео с сжатием) ==================
router.post('/seasons/:id/episodes', requireAuth, requireUploadPermission, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'poster', maxCount: 1 }
]), async (req, res) => {
  try {
    const seasonId = Number(req.params.id);
    const { episodeNumber, title } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files?.video?.[0]) {
      return res.status(400).json({ error: 'Видео файл обязателен' });
    }

    const videoFile = files.video[0];
    const tempVideoPath = videoFile.path;
    const compressedVideoPath = tempVideoPath.replace(/\.[^.]+$/, '_compressed.mp4');
    const tempFiles = [tempVideoPath, compressedVideoPath];

    try {
      // Сжатие видео до 500MB
      await compressVideo(tempVideoPath, compressedVideoPath, 500);
      
      // Перенос сжатого видео в постоянное хранилище
      const finalVideoPath = path.join(uploadDir, path.basename(compressedVideoPath));
      fs.renameSync(compressedVideoPath, finalVideoPath);
      const videoUrl = `/uploads/${path.basename(finalVideoPath)}`;

      // Обработка постера
      let posterPath = '';
      if (files?.poster?.[0]) {
        const posterFile = files.poster[0];
        posterPath = `/uploads/${posterFile.filename}`;
        tempFiles.push(posterFile.path);
      }

      // Сохранение в БД
      const { rows } = await query(
        `INSERT INTO episodes (season_id, episode_number, title, video_url, poster)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [seasonId, Number(episodeNumber), title || `Эпизод ${episodeNumber}`, videoUrl, posterPath]
      );

      // Очистка временных файлов (кроме исходного видео)
      cleanupTempFiles([tempVideoPath]);

      res.json({ episodeId: rows[0].id });
    } catch (compressErr: any) {
      console.error('[video compression]', compressErr.message);
      cleanupTempFiles(tempFiles);
      res.status(500).json({ error: 'Ошибка сжатия видео' });
    }
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
      `SELECT a.id, a.title, a.poster, a.year
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
      `SELECT v.*, e.title as episode_title, a.title as anime_title, a.poster as anime_poster
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
    // Получаем информацию о файлах для удаления
    const animeRes = await query(
      `SELECT poster, banner FROM anime WHERE id = $1`,
      [req.params.id]
    );
    const anime = animeRes.rows[0];
    
    // Удаляем связанные файлы
    if (anime?.poster) {
      const posterPath = path.join(uploadDir, path.basename(anime.poster));
      if (fs.existsSync(posterPath)) fs.unlinkSync(posterPath);
    }
    if (anime?.banner) {
      const bannerPath = path.join(uploadDir, path.basename(anime.banner));
      if (fs.existsSync(bannerPath)) fs.unlinkSync(bannerPath);
    }
    
    // Удаляем аниме из БД
    await query(`DELETE FROM anime WHERE id = $1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[admin delete anime]', err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ================== STATIC FILES ==================
// Отдача загруженных файлов
router.use('/uploads', (req, res, next) => {
  const filePath = path.join(uploadDir, req.path);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    next();
  }
});

export default router;