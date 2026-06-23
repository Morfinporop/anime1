-- ============================================================
-- AnimeWorld — SQL-скрипт инициализации таблиц PostgreSQL
-- ============================================================
-- Этот файл дублирует логику из server/src/db.js — он нужен,
-- если вы хотите один раз выполнить миграцию вручную через psql.
-- Однако таблицы создаются и автоматически при старте приложения
-- (см. функцию initDatabase в server/src/db.js), так что отдельный
-- запуск этого скрипта НЕ обязателен.
--
-- Запуск:  psql "$DATABASE_URL" -f init.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- USERS — автоинкремент строго с 1
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS users_id_seq START 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 0));

-- ANIME
CREATE TABLE IF NOT EXISTS anime (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    poster      TEXT NOT NULL DEFAULT '',
    type        VARCHAR(16) NOT NULL CHECK (type IN ('season','movie')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EPISODES
CREATE TABLE IF NOT EXISTS episodes (
    id             SERIAL PRIMARY KEY,
    anime_id       INTEGER NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
    season         INTEGER NOT NULL DEFAULT 1,
    episode_number INTEGER NOT NULL DEFAULT 1,
    title          VARCHAR(255) NOT NULL,
    description    TEXT NOT NULL DEFAULT '',
    video_url      TEXT NOT NULL,
    duration       INTEGER NOT NULL DEFAULT 0,
    audio_tracks   JSONB NOT NULL DEFAULT '[]'::jsonb,
    qualities      JSONB NOT NULL DEFAULT '["720p"]'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (anime_id, season, episode_number)
);
CREATE INDEX IF NOT EXISTS idx_episodes_anime ON episodes(anime_id, season);

-- COMMENTS
CREATE TABLE IF NOT EXISTS comments (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_episode ON comments(episode_id, created_at DESC);

-- RATINGS (1..10)
CREATE TABLE IF NOT EXISTS ratings (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    value       INTEGER NOT NULL CHECK (value BETWEEN 1 AND 10),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, episode_id)
);

-- LIKES / DISLIKES
CREATE TABLE IF NOT EXISTS likes (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    type        VARCHAR(16) NOT NULL CHECK (type IN ('like','dislike')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, episode_id)
);

-- VIEW HISTORY
CREATE TABLE IF NOT EXISTS view_history (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    episode_id  INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_history_user ON view_history(user_id, watched_at DESC);

-- ============================================================
-- Готово. Все таблицы созданы и проиндексированы.
-- ============================================================