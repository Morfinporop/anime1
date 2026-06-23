-- ============================================================
-- AnimeWorld — PostgreSQL Schema
-- ============================================================
-- Каждый statement выполняется отдельно для устойчивости к ошибкам

-- 1. Пользователи
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_color VARCHAR(16) NOT NULL DEFAULT '#7aa3ff',
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  can_upload BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Аниме (верхний уровень)
CREATE TABLE IF NOT EXISTS anime (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  banner_data BYTEA,
  banner_mime VARCHAR(50),
  genres TEXT[] NOT NULL DEFAULT '{}',
  year INT NOT NULL DEFAULT 2024,
  age_rating VARCHAR(8) NOT NULL DEFAULT '12+',
  type VARCHAR(16) NOT NULL DEFAULT 'season',
  voiceovers TEXT[] NOT NULL DEFAULT '{}',
  subtitles TEXT[] NOT NULL DEFAULT '{}',
  likes_count INT NOT NULL DEFAULT 0,
  dislikes_count INT NOT NULL DEFAULT 0,
  views_count INT NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anime_created_at ON anime(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anime_title ON anime(LOWER(title));

-- 3. Сезоны
CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  anime_id INT NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  season_number INT NOT NULL DEFAULT 1,
  poster_data BYTEA,
  poster_mime VARCHAR(50),
  description TEXT NOT NULL DEFAULT '',
  episodes_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(anime_id, season_number)
);

CREATE INDEX IF NOT EXISTS idx_seasons_anime ON seasons(anime_id);

-- 4. Серии
CREATE TABLE IF NOT EXISTS episodes (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  anime_id INT NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  episode_number INT NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  video_data BYTEA,
  video_mime VARCHAR(50),
  duration_seconds INT NOT NULL DEFAULT 0,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  voiceovers TEXT[] NOT NULL DEFAULT '{}',
  subtitles TEXT[] NOT NULL DEFAULT '{}',
  audio_tracks JSONB NOT NULL DEFAULT '[]'::jsonb,
  quality_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
  views_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(season_id, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id, episode_number);
CREATE INDEX IF NOT EXISTS idx_episodes_anime ON episodes(anime_id);

-- 5. Оценки
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  score SMALLINT NOT NULL CHECK (score >= 1 AND score <= 10),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, anime_id)
);

-- 6. Лайки/дизлайки
CREATE TABLE IF NOT EXISTS anime_votes (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  vote SMALLINT NOT NULL CHECK (vote = 1 OR vote = -1),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

-- 7. Комментарии
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  anime_id INT REFERENCES anime(id) ON DELETE CASCADE,
  episode_id INT REFERENCES episodes(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_episode ON comments(episode_id, created_at DESC);

-- 8. Лайки комментариев
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id INT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, comment_id)
);

-- 9. Избранное
CREATE TABLE IF NOT EXISTS favorites (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id INT NOT NULL REFERENCES anime(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, anime_id)
);

-- 10. История просмотров
CREATE TABLE IF NOT EXISTS history (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id, watched_at DESC);

-- 11. Прогресс просмотра
CREATE TABLE IF NOT EXISTS progress (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  position_seconds REAL NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0,
  voiceover VARCHAR(80),
  quality VARCHAR(16),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, episode_id)
);

-- 12. Просмотры (30+ сек = засчитан)
CREATE TABLE IF NOT EXISTS views (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  watched_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, episode_id)
);