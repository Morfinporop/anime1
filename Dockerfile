FROM node:20-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./

# Устанавливаем зависимости
RUN npm ci --legacy-peer-deps

# Копируем исходный код
COPY . .

# Строим проект
RUN npm run build

# Объявляем порт
EXPOSE 4000

# Запускаем приложение
CMD ["npm", "start"]