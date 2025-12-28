# 🐳 Деплой на сервер через Docker

## Быстрый старт

### 1. На вашем сервере:

```bash
# Клонируйте репозиторий
git clone <ваш-репозиторий>
cd Poker2

# Запустите Docker
docker-compose up -d

# Проверьте статус
docker-compose ps
```

### 2. Получите URL:

- Если у вас есть домен: `https://ваш-домен.com`
- Если только IP: `http://ВАШ_IP:3000`
- Или используйте Cloudflare Tunnel на сервере

---

## Настройка домена (опционально)

### С Nginx:

```nginx
server {
    listen 80;
    server_name ваш-домен.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### С Cloudflare Tunnel на сервере:

```bash
# Установите cloudflared на сервере
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared

# Запустите туннель
cloudflared tunnel --url http://localhost:3000
```

---

## Команды Docker

```bash
# Запуск
docker-compose up -d

# Остановка
docker-compose down

# Просмотр логов
docker-compose logs -f

# Перезапуск
docker-compose restart

# Обновление
git pull
docker-compose up -d --build
```

---

## Безопасность

1. Настройте firewall (откройте только нужные порты)
2. Используйте HTTPS (Let's Encrypt)
3. Настройте аутентификацию (если нужно)

---

## Автоматический деплой

Создайте файл `deploy.sh`:

```bash
#!/bin/bash
cd /path/to/Poker2
git pull
docker-compose down
docker-compose up -d --build
```

Запуск: `./deploy.sh`

