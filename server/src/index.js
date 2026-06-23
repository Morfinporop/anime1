import express from 'express';
import cors from 'cors';
import { initDatabase, pool } from './db.js';
import authRouter from './routes/auth.js';
import animeRouter from './routes/anime.js';
import episodesRouter from './routes/episodes.js';
import usersRouter from './routes/users.js';
import adminRouter from './routes/admin.js';
import ogRouter from './routes/og.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', authRouter);
app.use('/api/anime', animeRouter);
app.use('/api/episodes', episodesRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);
app.use('/api/og', ogRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Запуск: сначала инициализируем схему, затем поднимаем HTTP
async function start() {
  try {
    if (!process.env.DATABASE_URL) {
      console.warn('[start] ⚠️  DATABASE_URL не задан. Бэкенд не сможет подключиться к PostgreSQL.');
      console.warn('[start] ⚠️  Установите переменную: export DATABASE_URL="postgres://user:pass@localhost:5432/animeworld"');
    } else {
      await initDatabase();
    }
    app.listen(PORT, () => {
      console.log(`[animeworld] 🚀 сервер запущен на http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[start] ❌ критическая ошибка при запуске:', err);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[shutdown] SIGTERM получен, закрываю пул соединений...');
  await pool.end();
  process.exit(0);
});