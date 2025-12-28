# Используем Node.js 20 Alpine (легкий образ)
FROM node:20-alpine

# Рабочая директория
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Порт приложения
EXPOSE 3000

# Запуск
CMD ["node", "server.js"]
