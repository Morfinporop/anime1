// AnimeWorld API Server — Node.js + Express + PostgreSQL
// Хостинг: Railway / любой PaaS с переменной DATABASE_URL

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { initDatabase, query, pool } from './db.js';
import { router } from './routes.js';
import { authMiddleware, hashPassword } from './auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '4000');
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(cors({
  origin: true,
  credentials: true,
}));

// Увеличенный лимит для загрузки видео (base64) — до 600 МБ
app.use(express.json({ limit: '600mb' }));
app.use(express.urlencoded({ extended: true, limit: '600mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// API роуты
app.use('/api', router);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: NODE_ENV, db: !!pool, ts: Date.now() });
});

// ============ STATIC FRONTEND (для Railway / прод) ============
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  console.log('[static] Раздача dist/ из', distPath);
  app.use(express.static(distPath));

  // SSR для OG метатегов
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    try {
      const indexPath = path.join(distPath, 'index.html');
      let html = fs.readFileSync(indexPath, 'utf-8');

      // Динамические OG-метатеги для ботов
      let ogTitle = 'AnimeWorld';
      let ogDescription = 'Смотри аниме онлайн бесплатно в хорошем качестве';
      let ogImage = '/images/logov.png';

      const animeMatch = req.path.match(/\/(?:anime|id)(\d+)/) || req.path.match(/\/id(\d+)/);
      const epMatch = req.path.match(/\/watch\/(\d+)/);

      try {
        if (animeMatch && pool) {
          const r = await query('SELECT title, description FROM anime WHERE id = $1', [animeMatch[1]]);
          if (r.rows[0]) {
            ogTitle = r.rows[0].title;
            ogDescription = (r.rows[0].description || '').slice(0, 200);
          }
        }
        if (epMatch && pool) {
          const r = await query(
            `SELECT a.title AS anime_title, a.description, e.title AS episode_title
             FROM episodes e JOIN anime a ON a.id = e.anime_id WHERE e.id = $1`,
            [epMatch[1]]
          );
          if (r.rows[0]) {
            ogTitle = `${r.rows[0].anime_title} — ${r.rows[0].episode_title || 'Серия'}`;
            ogDescription = (r.rows[0].description || '').slice(0, 200);
          }
        }
      } catch {}

      const isBot = /bot|crawler|spider|preview|facebook|telegram|discord|whatsapp/i.test(req.headers['user-agent'] || '');

      if (isBot) {
        html = html
          .replace(/<title>[^<]*<\/title>/, `<title>${ogTitle} — AnimeWorld</title>`)
          .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${ogDescription.replace(/"/g, '&quot;')}" />`)
          .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />`)
          .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />`);
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      next();
    }
  });
} else {
  console.warn('[static] dist/ не найден — фронтенд не будет раздаваться. Запустите `npm run build`');
}

// ============ STARTUP ============
// Админ НЕ создаётся автоматически — пользователь сам регистрируется,
// а логика "если ник Morfin — админ" срабатывает при регистрации (см. /api/auth/register).
async function ensureAdmin() {
  // no-op
}

async function start() {
  console.log(`[server] Запуск на порту ${PORT}...`);

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[server] ✓ AnimeWorld API запущен на http://0.0.0.0:${PORT}`);
    console.log(`[server] Режим: ${NODE_ENV}`);
  });

  server.on('error', (err: any) => {
    console.error('[server.error]', err);
    if (err.code === 'EADDRINUSE') {
      console.error(`[fatal] Порт ${PORT} уже занят`);
      process.exit(1);
    }
  });

  const shutdown = (signal: string) => {
    console.log(`[shutdown] ${signal}`);
    server.close(() => {
      pool?.end().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Инициализация БД
  try {
    await initDatabase();
    await ensureAdmin();
    console.log('[init] ✓ База данных готова');
  } catch (err: any) {
    console.error('[init.error]', err.message);
  }
}

start();