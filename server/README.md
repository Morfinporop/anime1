# AnimeWorld Backend (Node.js / Express + PostgreSQL)

Это готовый production-ready бэкенд для AnimeWorld. Подключается к PostgreSQL
через переменную окружения `DATABASE_URL`. Все таблицы создаются автоматически
при старте приложения — отдельный SQL-скрипт не нужен.

## Запуск

```bash
cd server
npm install
export DATABASE_URL="postgres://user:pass@localhost:5432/animeworld"
npm start
```

Сервер слушает порт `4000` (можно изменить через `PORT`). Фронтенд (Vite dev
сервер) проксирует запросы `/api/*` на этот порт через `vite.config.ts`.

## API

### Auth
- `POST /api/auth/register` — `{ username, password }`
- `POST /api/auth/login` — `{ username, password }`

### Anime / Episodes
- `GET /api/anime` — список всех аниме
- `GET /api/anime/:id` — аниме по ID
- `GET /api/anime/:id/episodes` — все эпизоды аниме
- `GET /api/episodes/:id` — эпизод по ID

### Взаимодействие
- `GET /api/episodes/:id/comments`
- `POST /api/episodes/:id/comments` — `{ user_id, content }`
- `GET /api/episodes/:id/rating?user_id=...`
- `POST /api/episodes/:id/rating` — `{ user_id, value }`
- `GET /api/episodes/:id/likes?user_id=...`
- `POST /api/episodes/:id/likes` — `{ user_id, type: 'like'|'dislike' }`
- `POST /api/users/:id/history` — `{ episode_id }`
- `GET /api/users/:id/history`

### Admin
- `POST /api/admin/anime` — создать аниме
- `POST /api/admin/episodes` — создать эпизод

### SSR / OG-Meta
- `GET /api/og?path=/id123` — возвращает готовые `<meta>` теги для OG/Twitter
  карточек. Используется как fallback для ботов, которые не выполняют JS.

## Безопасность
- Пароли хэшируются через `bcryptjs`.
- Роль `admin` присваивается автоматически пользователю с ником `Morfin`.
- CORS настроен для локального dev (3000 / 5173).
- Все запросы валидируются на сервере.