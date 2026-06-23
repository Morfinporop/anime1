// db.js — подключение к PostgreSQL и авто-инициализация схемы
import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

// Инициализация таблиц. Запускается один раз при старте приложения.
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // USERS с автоинкрементом строго с 1
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        username      VARCHAR(64) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role          VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
        can_upload    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE SEQUENCE IF NOT EXISTS users_id_seq START 1;
      ALTER SEQUENCE users_id_seq RESTART WITH 1;
      SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0));
    `);

    // ANIME — поля: id, title, description, banner, type, genres, year, age_rating, views, likes, dislikes
    await client.query(`
      CREATE TABLE IF NOT EXISTS anime (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(255) NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        banner      TEXT NOT NULL DEFAULT '',
        type        VARCHAR(16) NOT NULL CHECK (type IN ('season','movie','single')),
        genres      JSONB NOT NULL DEFAULT '[]'::jsonb,
        year        INTEGER NOT NULL DEFAULT 2024,
        age_rating  VARCHAR(8) NOT NULL DEFAULT '12+',
        views       INTEGER NOT NULL DEFAULT 0,
        likes       INTEGER NOT NULL DEFAULT 0,
        dislikes    INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // EPISODES — quality_sources + audio_tracks
    await client.query(`
      CREATE TABLE IF NOT EXISTS episodes (
        id             SERIAL PRIMARY KEY,
        anime_id       INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
        season         INTEGER NOT NULL DEFAULT 1,
        episode_number INTEGER NOT NULL DEFAULT 1,
        title          VARCHAR(255) NOT NULL,
        description    TEXT NOT NULL DEFAULT '',
        video_url      TEXT NOT NULL,
        quality_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
        audio_tracks    JSONB NOT NULL DEFAULT '[]'::jsonb,
        audio_label     VARCHAR(64) NOT NULL DEFAULT 'Оригинал',
        duration        INTEGER NOT NULL DEFAULT 0,
        views           INTEGER NOT NULL DEFAULT 0,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (anime_id, season, episode_number)
      );
      CREATE INDEX IF NOT EXISTS idx_episodes_anime ON episodes(anime_id, season);
    `);

    // COMMENTS
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        content     TEXT NOT NULL,
        likes       INTEGER NOT NULL DEFAULT 0,
        likers      JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_comments_episode ON comments(episode_id, created_at DESC);
    `);

    // RATINGS
    await client.query(`
      CREATE TABLE IF NOT EXISTS ratings (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        value       INTEGER NOT NULL CHECK (value BETWEEN 1 AND 10),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, episode_id)
      );
    `);

    // LIKES (лайки/дизлайки на уровне аниме — привязка к первому эпизоду)
    await client.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        type        VARCHAR(16) NOT NULL CHECK (type IN ('like','dislike')),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, episode_id)
      );
    `);

    // VIEW HISTORY
    await client.query(`
      CREATE TABLE IF NOT EXISTS view_history (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
        watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_history_user ON view_history(user_id, watched_at DESC);
    `);

    // FAVORITES
    await client.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        anime_id    INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, anime_id)
      );
    `);

    await client.query('COMMIT');
    console.log('[db] ✅ схема базы данных инициализирована');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[db] ❌ ошибка инициализации схемы:', err);
    throw err;
  } finally {
    client.release();
  }
}