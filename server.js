const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const https = require('https');
const httpLib = require('http');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Главная страница - меню выбора игр
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Управление процессами
let tunnelProcess = null;
let serverProcess = null;

// Роут для launcher
app.get('/launcher', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'launcher.html'));
});

// Роут для простого launcher
app.get('/start', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'launcher-simple.html'));
});

// Роут для главного меню казино
app.get('/casino', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'casino.html'));
});

// Роут для Black Jack
app.get('/blackjack', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'blackjack.html'));
});

// Роут для покера (старая страница)
app.get('/poker', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'poker.html'));
});

// Роут для Монетки
app.get('/coinflip', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'coinflip.html'));
});

// Роут для Слот-машины
app.get('/slots', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'slots.html'));
});

// API для управления сервером
app.get('/api/status', (req, res) => {
    // Проверяем, запущен ли основной сервер (этот процесс)
    const serverRunning = true; // Этот процесс и есть сервер
    
    // Проверяем туннель
    const tunnelRunning = tunnelProcess && !tunnelProcess.killed;
    let publicUrl = null;
    
    // Проверяем сохраненный URL
    try {
        if (fs.existsSync(path.join(__dirname, 'PUBLIC_URL.txt'))) {
            const savedUrl = fs.readFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), 'utf8').trim();
            if (savedUrl) {
                publicUrl = savedUrl;
            }
        }
    } catch (e) {}
    
    // Пытаемся получить актуальный URL из ngrok API
    if (tunnelRunning) {
        httpLib.get('http://127.0.0.1:4040/api/tunnels', (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.tunnels && json.tunnels.length > 0) {
                        publicUrl = json.tunnels[0].public_url;
                        // Обновляем сохраненный URL
                        fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), publicUrl);
                    }
                } catch (e) {}
                res.json({
                    serverRunning,
                    tunnelRunning,
                    publicUrl
                });
            });
        }).on('error', () => {
            res.json({
                serverRunning,
                tunnelRunning,
                publicUrl
            });
        });
    } else {
        res.json({
            serverRunning,
            tunnelRunning,
            publicUrl
        });
    }
});

app.post('/api/start-tunnel', (req, res) => {
    if (tunnelProcess && !tunnelProcess.killed) {
        return res.json({ success: false, error: 'Туннель уже запущен' });
    }
    
    const ngrokPath = path.join(__dirname, 'ngrok.exe');
    if (!fs.existsSync(ngrokPath)) {
        return res.json({ success: false, error: 'ngrok не найден. Запустите setup-tunnel.bat' });
    }
    
    tunnelProcess = spawn(ngrokPath, ['http', '3000'], {
        cwd: __dirname,
        detached: false
    });
    
    tunnelProcess.on('error', (err) => {
        res.json({ success: false, error: err.message });
    });
    
    // Ждем немного и получаем URL
    setTimeout(() => {
        httpLib.get('http://127.0.0.1:4040/api/tunnels', (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.tunnels && json.tunnels.length > 0) {
                        const url = json.tunnels[0].public_url;
                        fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                        res.json({ success: true, url });
                    } else {
                        res.json({ success: true, message: 'Туннель запущен, URL будет доступен через несколько секунд' });
                    }
                } catch (e) {
                    res.json({ success: true, message: 'Туннель запущен, проверьте http://127.0.0.1:4040' });
                }
            });
        }).on('error', () => {
            res.json({ success: true, message: 'Туннель запущен, проверьте http://127.0.0.1:4040' });
        });
    }, 3000);
});

app.post('/api/stop-tunnel', (req, res) => {
    if (!tunnelProcess || tunnelProcess.killed) {
        return res.json({ success: false, error: 'Туннель не запущен' });
    }
    
    tunnelProcess.kill();
    tunnelProcess = null;
    res.json({ success: true });
});

// Удалено - дубликат, используется версия ниже

app.post('/api/stop-server', (req, res) => {
    // Останавливаем этот процесс
    res.json({ success: true, message: 'Сервер будет остановлен' });
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});

// API для работы с ngrok токеном
app.get('/api/ngrok-token', (req, res) => {
    try {
        const tokenPath = path.join(__dirname, '.ngrok-token');
        if (fs.existsSync(tokenPath)) {
            const token = fs.readFileSync(tokenPath, 'utf8').trim();
            res.json({ token });
        } else {
            res.json({ token: null });
        }
    } catch (e) {
        res.json({ token: null });
    }
});

app.post('/api/ngrok-token', (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.json({ success: false, error: 'Токен не указан' });
        }
        
        const tokenPath = path.join(__dirname, '.ngrok-token');
        fs.writeFileSync(tokenPath, token, 'utf8');
        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/api/setup-ngrok', (req, res) => {
    try {
        const tokenPath = path.join(__dirname, '.ngrok-token');
        const ngrokPath = path.join(__dirname, 'ngrok.exe');
        
        if (!fs.existsSync(tokenPath)) {
            return res.json({ success: false, error: 'Токен не найден. Сохраните токен в настройках.' });
        }
        
        if (!fs.existsSync(ngrokPath)) {
            return res.json({ success: false, error: 'ngrok не найден. Запустите setup-tunnel.bat для установки.' });
        }
        
        const token = fs.readFileSync(tokenPath, 'utf8').trim();
        
        // Настраиваем ngrok
        exec(`"${ngrokPath}" config add-authtoken ${token}`, (error, stdout, stderr) => {
            if (error) {
                res.json({ success: false, error: error.message });
            } else {
                res.json({ success: true, message: 'ngrok настроен успешно' });
            }
        });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// Запуск сервера через PowerShell
app.post('/api/start-server', (req, res) => {
    // Проверяем, запущен ли уже
    exec('tasklist /FI "IMAGENAME eq node.exe"', (error, stdout) => {
        if (stdout.includes('node.exe')) {
            return res.json({ success: true, message: 'Сервер уже запущен' });
        }
        
        // Запускаем сервер
        const serverProcess = spawn('npm', ['start'], {
            cwd: __dirname,
            detached: true,
            stdio: 'ignore',
            shell: true
        });
        
        serverProcess.unref();
        res.json({ success: true, message: 'Сервер запускается...' });
    });
});

// Запуск туннеля (приоритет Cloudflare, потом ngrok)
app.post('/api/start-tunnel-cloudflare', (req, res) => {
    // Устанавливаем таймаут для ответа
    res.setTimeout(30000, () => {
        if (!res.headersSent) {
            res.json({ success: true, message: 'Cloudflare Tunnel запускается... (таймаут, но процесс может быть запущен)' });
        }
    });
    
    try {
        // Сначала проверяем Cloudflare Tunnel (не требует токена)
        exec('tasklist /FI "IMAGENAME eq cloudflared.exe"', { timeout: 5000 }, (error, stdout) => {
            if (error) {
                console.error('Ошибка проверки cloudflared:', error);
            }
            
            if (stdout && stdout.includes('cloudflared.exe')) {
                if (!res.headersSent) {
                    return res.json({ success: true, message: 'Cloudflare Tunnel уже запущен' });
                }
                return;
            }
            
            const os = require('os');
            const cloudflaredPath = path.join(os.tmpdir(), 'cloudflared.exe');
            
            // Скачиваем если нет
            if (!fs.existsSync(cloudflaredPath)) {
                const https = require('https');
                const file = fs.createWriteStream(cloudflaredPath);
                
                // Таймаут для скачивания
                const downloadTimeout = setTimeout(() => {
                    file.destroy();
                    if (!res.headersSent) {
                        tryNgrok(res);
                    }
                }, 30000);
                
                https.get('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe', (response) => {
                    response.pipe(file);
                    file.on('finish', () => {
                        clearTimeout(downloadTimeout);
                        file.close(() => {
                            if (!res.headersSent) {
                                startTunnel(cloudflaredPath, res);
                            }
                        });
                    });
                }).on('error', (err) => {
                    clearTimeout(downloadTimeout);
                    console.error('Ошибка скачивания cloudflared:', err);
                    // Если Cloudflare не скачался, пробуем ngrok
                    if (!res.headersSent) {
                        tryNgrok(res);
                    }
                });
            } else {
                if (!res.headersSent) {
                    startTunnel(cloudflaredPath, res);
                }
            }
        });
    } catch (err) {
        console.error('Ошибка в start-tunnel-cloudflare:', err);
        if (!res.headersSent) {
            res.json({ success: false, error: 'Ошибка запуска туннеля: ' + err.message });
        }
    }
});

function tryNgrok(res) {
    // Пробуем ngrok как запасной вариант
    const tokenPath = path.join(__dirname, '.ngrok-token');
    const ngrokPath = path.join(__dirname, 'ngrok.exe');
    
    if (fs.existsSync(tokenPath) && fs.existsSync(ngrokPath)) {
        exec('tasklist /FI "IMAGENAME eq ngrok.exe"', (error, stdout) => {
            if (stdout.includes('ngrok.exe')) {
                return res.json({ success: true, message: 'Ngrok туннель уже запущен' });
            }
            
            const ngrokProcess = spawn(ngrokPath, ['http', '3000'], {
                cwd: __dirname,
                detached: true,
                stdio: 'ignore',
                shell: true
            });
            ngrokProcess.unref();
            return res.json({ success: true, message: 'Ngrok туннель запускается...', type: 'ngrok' });
        });
    } else {
        res.json({ success: false, error: 'Не удалось запустить туннель. Установите Cloudflare Tunnel или ngrok.' });
    }
}

function startTunnel(cloudflaredPath, res) {
    try {
        const logPath = path.join(__dirname, 'cloudflare-tunnel.log');
        
        // Удаляем старый лог если есть
        if (fs.existsSync(logPath)) {
            try {
                fs.unlinkSync(logPath);
            } catch (e) {}
        }
        
        const tunnelProcess = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:3000'], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true
        });
        
        // Записываем вывод в лог-файл
        // Создаем файл для лога
        const logFile = fs.createWriteStream(logPath, { flags: 'w' });
        
        // Записываем вывод в файл и в консоль
        tunnelProcess.stdout.on('data', (data) => {
            logFile.write(data);
            const text = data.toString();
            console.log('Cloudflare:', text);
            // Ищем URL в выводе сразу
            const urlMatch = text.match(/(https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.trycloudflare\.com)/i);
            if (urlMatch && urlMatch[1]) {
                const url = urlMatch[1].trim();
                fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                console.log('✅ URL найден и сохранен:', url);
            }
        });
        
        tunnelProcess.stderr.on('data', (data) => {
            logFile.write(data);
            const text = data.toString();
            console.log('Cloudflare (stderr):', text);
            // Ищем URL в ошибках тоже (иногда URL там)
            const urlMatch = text.match(/(https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.trycloudflare\.com)/i);
            if (urlMatch && urlMatch[1]) {
                const url = urlMatch[1].trim();
                fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                console.log('✅ URL найден в stderr и сохранен:', url);
            }
        });
        
        tunnelProcess.on('close', () => {
            logFile.end();
        });
        
        tunnelProcess.on('error', (err) => {
            console.error('Ошибка запуска cloudflared:', err);
            if (!res.headersSent) {
                res.json({ success: false, error: 'Не удалось запустить Cloudflare Tunnel: ' + err.message });
            }
        });
        
        tunnelProcess.unref();
        
        // Отвечаем сразу, не ждем запуска
        if (!res.headersSent) {
            res.json({ success: true, message: 'Cloudflare Tunnel запускается...' });
        }
        
        // Парсим лог несколько раз с интервалами
        let attempts = 0;
        const maxAttempts = 15; // 15 попыток по 2 секунды = 30 секунд
        
        const parseLog = setInterval(() => {
            attempts++;
            try {
                if (fs.existsSync(logPath)) {
                    const logContent = fs.readFileSync(logPath, 'utf8');
                    
                    // Ищем URL в разных форматах
                    // Паттерн для многосегментных доменов: reads-berkeley-ranch-reception.trycloudflare.com
                    const urlPatterns = [
                        /https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\.trycloudflare\.com/gi, // Многосегментные домены
                        /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi, // Простые домены
                        /Visit it at[^\n]*\n[^\n]*https:\/\/([^\s\n]+)/i // Строка "Visit it at" с URL на следующей строке
                    ];
                    
                    for (const pattern of urlPatterns) {
                        const matches = logContent.match(pattern);
                        if (matches && matches.length > 0) {
                            let url = matches[matches.length - 1];
                            
                            // Если это не полный URL, добавляем https://
                            if (!url.startsWith('http')) {
                                url = 'https://' + url;
                            }
                            
                            // Проверяем, что это валидный URL
                            if (url.includes('trycloudflare.com') || url.includes('cloudflare.com')) {
                                fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                                console.log('✅ URL автоматически сохранен:', url);
                                clearInterval(parseLog);
                                return;
                            }
                        }
                    }
                    
                    // Также ищем строку "Your quick Tunnel has been created! Visit it at"
                    // Ищем паттерн: "Visit it at" на одной строке, затем URL на следующей
                    const visitMatch = logContent.match(/Visit it at[^\n]*\n[^\n]*(https:\/\/[^\s\n]+)/i);
                    if (visitMatch && visitMatch[1]) {
                        const url = visitMatch[1].trim();
                        if (url.includes('trycloudflare.com')) {
                            fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                            console.log('✅ URL автоматически сохранен (из строки Visit it at):', url);
                            clearInterval(parseLog);
                            return;
                        }
                    }
                    
                    // Ищем URL после строки "Your quick Tunnel has been created!"
                    const createdMatch = logContent.match(/Your quick Tunnel has been created![^\n]*\n[^\n]*INF[^\n]*\|\s*(https:\/\/[^\s\n]+)/i);
                    if (createdMatch && createdMatch[1]) {
                        const url = createdMatch[1].trim();
                        if (url.includes('trycloudflare.com')) {
                            fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                            console.log('✅ URL автоматически сохранен (из строки created):', url);
                            clearInterval(parseLog);
                            return;
                        }
                    }
                    
                    // Ищем любой URL с trycloudflare.com в логе
                    const anyUrlMatch = logContent.match(/(https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.trycloudflare\.com)/i);
                    if (anyUrlMatch && anyUrlMatch[1]) {
                        const url = anyUrlMatch[1].trim();
                        fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                        console.log('✅ URL автоматически сохранен (любой найденный):', url);
                        clearInterval(parseLog);
                        return;
                    }
                }
            } catch (e) {
                console.error('Ошибка парсинга лога:', e);
            }
            
            // Останавливаем после maxAttempts попыток
            if (attempts >= maxAttempts) {
                clearInterval(parseLog);
                console.log('⚠️ URL не найден в логе после', maxAttempts * 2, 'секунд');
            }
        }, 2000); // Проверяем каждые 2 секунды
    } catch (err) {
        console.error('Ошибка в startTunnel:', err);
        if (!res.headersSent) {
            res.json({ success: false, error: 'Ошибка: ' + err.message });
        }
    }
}

// Получение URL из туннеля
app.get('/api/get-tunnel-url', (req, res) => {
    // Сначала проверяем Cloudflare Tunnel (приоритет)
    checkCloudflareTunnel(res, () => {
        // Если Cloudflare не работает, пробуем ngrok
        httpLib.get('http://127.0.0.1:4040/api/tunnels', (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.tunnels && json.tunnels.length > 0) {
                        const url = json.tunnels[0].public_url;
                        fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                        return res.json({ url });
                    }
                } catch (e) {}
                res.json({ url: null });
            });
        }).on('error', () => {
            res.json({ url: null });
        });
    });
});

function checkCloudflareTunnel(res, onNotFound) {
    // Проверяем, запущен ли Cloudflare Tunnel
    exec('tasklist /FI "IMAGENAME eq cloudflared.exe"', (error, stdout) => {
        if (stdout.includes('cloudflared.exe')) {
            // Cloudflare Tunnel запущен, пробуем получить URL из лог-файла
            try {
                const logPath = path.join(__dirname, 'cloudflare-tunnel.log');
                if (fs.existsSync(logPath)) {
                    // Читаем весь файл (может быть большой, но URL может быть где угодно)
                    const logContent = fs.readFileSync(logPath, 'utf8');
                    
                    // Ищем URL в разных форматах (включая многосегментные домены)
                    const urlPatterns = [
                        /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.[a-z0-9-]+\.trycloudflare\.com/g, // reads-berkeley-ranch-reception.trycloudflare.com
                        /https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.trycloudflare\.com/g,
                        /https:\/\/[a-z0-9-]+\.trycloudflare\.com/g,
                        /https:\/\/[a-z0-9-]+\.cloudflare\.com/g
                    ];
                    
                    for (const pattern of urlPatterns) {
                        const matches = logContent.match(pattern);
                        if (matches && matches.length > 0) {
                            const url = matches[matches.length - 1]; // Берем последний (самый свежий)
                            fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
                            return res.json({ url });
                        }
                    }
                }
                
                // Пробуем прочитать из сохраненного файла
                const urlPath = path.join(__dirname, 'PUBLIC_URL.txt');
                if (fs.existsSync(urlPath)) {
                    const url = fs.readFileSync(urlPath, 'utf8').trim();
                    if (url && url.startsWith('https://') && (url.includes('trycloudflare.com') || url.includes('cloudflare'))) {
                        return res.json({ url });
                    }
                }
            } catch (e) {
                console.error('Ошибка чтения лога Cloudflare:', e);
            }
            
            // Если URL не найден, возвращаем null - пользователь увидит в окне туннеля
            return res.json({ url: null, message: 'Cloudflare Tunnel запущен. Скопируйте URL из окна туннеля или используйте "✏️ Ввести URL вручную"' });
        } else {
            // Туннель не запущен, пробуем ngrok
            if (onNotFound) {
                onNotFound();
            } else {
                res.json({ url: null });
            }
        }
    });
}

// Сохранение URL
app.post('/api/save-url', (req, res) => {
    try {
        const { url } = req.body;
        if (url) {
            fs.writeFileSync(path.join(__dirname, 'PUBLIC_URL.txt'), url);
            fs.writeFileSync(path.join(__dirname, 'URL_ДЛЯ_ДРУЗЕЙ.txt'), url);
            res.json({ success: true });
        } else {
            res.json({ success: false, error: 'URL не указан' });
        }
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

// Запуск Docker
app.post('/api/start-docker', (req, res) => {
    // Проверяем Docker
    exec('docker --version', (error) => {
        if (error) {
            return res.json({ success: false, error: 'Docker не установлен или не запущен. Установите Docker Desktop.' });
        }
        
        // Проверяем, запущен ли уже контейнер
        exec('docker ps --filter "name=poker" --format "{{.Names}}"', (error, stdout) => {
            if (stdout.trim().includes('poker')) {
                // Контейнер уже запущен, получаем URL
                exec('docker ps --filter "name=poker" --format "{{.Ports}}"', (error, ports) => {
                    // Пробуем получить IP или домен
                    const urlPath = path.join(__dirname, 'DOCKER_URL.txt');
                    let dockerUrl = null;
                    if (fs.existsSync(urlPath)) {
                        dockerUrl = fs.readFileSync(urlPath, 'utf8').trim();
                    }
                    return res.json({ success: true, message: 'Docker уже запущен', url: dockerUrl });
                });
            } else {
                // Запускаем Docker
                exec('docker-compose up -d', { cwd: __dirname }, (error, stdout, stderr) => {
                    if (error) {
                        return res.json({ success: false, error: 'Ошибка запуска Docker: ' + error.message });
                    }
                    
                    // Ждем немного и получаем информацию
                    setTimeout(() => {
                        const urlPath = path.join(__dirname, 'DOCKER_URL.txt');
                        let dockerUrl = null;
                        if (fs.existsSync(urlPath)) {
                            dockerUrl = fs.readFileSync(urlPath, 'utf8').trim();
                        }
                        res.json({ success: true, message: 'Docker запущен', url: dockerUrl });
                    }, 3000);
                });
            }
        });
    });
});

// Игровые комнаты
const rooms = new Map();
// Таймеры для комнат
const roomTimers = new Map();
// Black Jack игры
const blackjackGames = new Map();
const BlackJackGame = require('./blackjack-game');

// Игровая логика
class PokerGame {
  constructor(roomId, adminId) {
    this.roomId = roomId;
    this.adminId = adminId; // ID первого игрока (админ)
    this.players = [];
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.state = 'waiting'; // waiting, betting, flop, turn, river, showdown
    this.bets = new Map();
    this.turnTimeLeft = 15; // Время на ход в секундах (15 сек для игроков)
    this.turnStartTime = null;
    this.buyInAmount = 1000; // Стартовый buy-in
    this.allowedBuyIn = true; // Разрешена ли докупка фишек (управляет админ)
    this.lastRaiseIndex = -1; // Индекс последнего игрока, который сделал рейз
    this.lastRaiseSize = 0; // Размер последнего рейза
    this.gameResults = null; // Результаты последней игры
    this.autoStartNextHand = false; // Флаг для автоматического старта следующей раздачи
    this.handHistory = []; // История раздач
    this.totalBetsThisHand = new Map(); // Общая сумма ставок каждого игрока за текущую раздачу
    this.playerStats = new Map(); // Статистика игроков
  }

  addPlayer(playerId, playerName) {
    if (this.players.length >= 6) return false;
    if (this.players.find(p => p.id === playerId)) return false;
    
    // Инициализируем статистику игрока
    if (!this.playerStats.has(playerId)) {
      this.playerStats.set(playerId, {
        handsPlayed: 0,
        handsWon: 0,
        totalProfit: 0,
        biggestWin: 0,
        biggestLoss: 0
      });
    }
    
    this.players.push({
      id: playerId,
      name: playerName,
      chips: this.buyInAmount,
      cards: [],
      folded: false,
      allIn: false,
      bet: 0,
      isBot: false,
      totalBuyIn: this.buyInAmount, // Общая сумма купленных фишек
      profit: 0 // Прибыль/убыток (chips - totalBuyIn)
    });
    return true;
  }

  addBot() {
    if (this.players.length >= 6) return false;
    if (this.players.find(p => p.isBot)) return false; // Один бот на комнату
    
    const botNames = ['Дилер Бот', 'Покерный Бот', 'ИИ Дилер', 'Бот-Игрок'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    
    this.players.push({
      id: 'bot_' + Date.now(),
      name: botName,
      chips: this.buyInAmount,
      cards: [],
      folded: false,
      allIn: false,
      bet: 0,
      isBot: true,
      totalBuyIn: this.buyInAmount,
      profit: 0
    });
    return true;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  // Логика принятия решений ботом
  botDecision(botPlayer) {
    if (botPlayer.folded || botPlayer.allIn) return null;

    const handStrength = this.evaluateHandStrength(botPlayer.cards, this.communityCards);
    const callAmount = this.currentBet - botPlayer.bet;
    
    // Минимальный рейз = currentBet + (lastRaiseSize или bigBlind)
    const minRaiseTotal = this.currentBet + Math.max(this.lastRaiseSize, this.bigBlind);
    const canRaise = botPlayer.chips + botPlayer.bet >= minRaiseTotal;
    
    // Если очень сильная рука - рейз
    if (handStrength > 0.8 && canRaise) {
      // Рейз = минимальный рейз + немного сверху
      const raiseTotal = Math.min(
        minRaiseTotal + this.bigBlind * 2,
        botPlayer.chips + botPlayer.bet // Максимум all-in
      );
      if (raiseTotal >= minRaiseTotal) {
        return { action: 'raise', amount: raiseTotal };
      }
    }
    
    // Если сильная рука - колл или небольшой рейз
    if (handStrength > 0.5) {
      if (canRaise && Math.random() < 0.3 && callAmount < botPlayer.chips * 0.3) {
        const raiseTotal = Math.min(
          minRaiseTotal + this.bigBlind,
          botPlayer.chips + botPlayer.bet
        );
        if (raiseTotal >= minRaiseTotal) {
          return { action: 'raise', amount: raiseTotal };
        }
      }
      if (callAmount <= botPlayer.chips) {
        return { action: 'call' };
      }
    }
    
    // Если средняя рука - колл при хороших шансах
    if (handStrength > 0.3) {
      if (callAmount === 0 || callAmount <= this.bigBlind * 2) {
        return { action: 'call' };
      }
    }
    
    // Чек если можно
    if (callAmount === 0) {
      return { action: 'call' };
    }
    
    // Колл при малой ставке
    if (callAmount <= this.bigBlind && Math.random() < 0.4) {
      return { action: 'call' };
    }
    
    // Иначе пас
    return { action: 'fold' };
  }

  // Оценка силы руки (0-1)
  evaluateHandStrength(playerCards, communityCards) {
    if (playerCards.length < 2) return 0;
    
    const allCards = [...playerCards, ...communityCards];
    if (allCards.length < 2) {
      // Префлоп - оценка по картам
      const card1 = playerCards[0];
      const card2 = playerCards[1];
      const highCard = Math.max(card1.value, card2.value);
      const lowCard = Math.min(card1.value, card2.value);
      const isPair = card1.value === card2.value;
      const isSuited = card1.suit === card2.suit;
      
      if (isPair) {
        if (highCard >= 10) return 0.8;
        if (highCard >= 7) return 0.6;
        return 0.4;
      }
      
      if (highCard >= 12 && lowCard >= 10) return 0.7; // AK, AQ, AJ, KQ, KJ
      if (highCard === 14 && lowCard >= 9) return 0.65; // A9+
      if (highCard >= 11 && lowCard >= 9 && isSuited) return 0.55;
      if (highCard >= 10) return 0.4;
      
      return 0.2;
    }
    
    // После флопа - оценка лучшей комбинации
    if (allCards.length >= 5) {
      const bestHand = this.getBestHand(playerCards, communityCards);
      const rank = this.getHandRank(bestHand);
      
      // Нормализация ранга (примерно)
      if (rank >= 8000000) return 1.0; // Straight Flush+
      if (rank >= 7000000) return 0.95; // Four of a Kind
      if (rank >= 6000000) return 0.9; // Full House
      if (rank >= 5000000) return 0.85; // Flush
      if (rank >= 4000000) return 0.75; // Straight
      if (rank >= 3000000) return 0.65; // Three of a Kind
      if (rank >= 2000000) return 0.55; // Two Pair
      if (rank >= 1000000) return 0.45; // Pair
      return 0.3; // High Card
    }
    
    return 0.3;
  }

  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];
    for (let suit of suits) {
      for (let rank of ranks) {
        this.deck.push({ suit, rank, value: this.getCardValue(rank) });
      }
    }
    this.shuffleDeck();
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  getCardValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
  }

  dealCards() {
    this.createDeck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.bets.clear();
    this.gameResults = null; // Сбрасываем результаты предыдущей игры
    this.lastRaiseIndex = -1;
    this.lastRaiseSize = 0;
    this.totalBetsThisHand.clear(); // Сбрасываем общие ставки за раздачу
    
    // Сброс состояния игроков
    this.players.forEach(player => {
      player.cards = [];
      player.folded = false;
      player.allIn = false;
      player.bet = 0;
    });

    // Раздача карт игрокам
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        if (!player.folded) {
          player.cards.push(this.deck.pop());
        }
      });
    }

    // Блайнды
    const smallBlindPlayer = this.players[this.dealerIndex];
    const bigBlindPlayer = this.players[(this.dealerIndex + 1) % this.players.length];
    
    smallBlindPlayer.bet = Math.min(this.smallBlind, smallBlindPlayer.chips);
    smallBlindPlayer.chips -= smallBlindPlayer.bet;
    this.pot += smallBlindPlayer.bet;
    // Отслеживаем общую ставку за раздачу
    this.totalBetsThisHand.set(smallBlindPlayer.id, (this.totalBetsThisHand.get(smallBlindPlayer.id) || 0) + smallBlindPlayer.bet);
    // Если игрок поставил все фишки в small blind, помечаем как all-in
    if (smallBlindPlayer.chips === 0) {
      smallBlindPlayer.allIn = true;
    }

    bigBlindPlayer.bet = Math.min(this.bigBlind, bigBlindPlayer.chips);
    bigBlindPlayer.chips -= bigBlindPlayer.bet;
    this.pot += bigBlindPlayer.bet;
    this.currentBet = bigBlindPlayer.bet;
    // Отслеживаем общую ставку за раздачу
    this.totalBetsThisHand.set(bigBlindPlayer.id, (this.totalBetsThisHand.get(bigBlindPlayer.id) || 0) + bigBlindPlayer.bet);
    // Если игрок поставил все фишки в big blind, помечаем как all-in
    if (bigBlindPlayer.chips === 0) {
      bigBlindPlayer.allIn = true;
    }

    this.currentPlayerIndex = (this.dealerIndex + 2) % this.players.length;
    this.state = 'betting';
    this.startTurnTimer();
  }
  
  startTurnTimer() {
    this.turnStartTime = Date.now();
    this.turnTimeLeft = 15; // 15 секунд на ход
  }
  
  getTimeLeft() {
    if (!this.turnStartTime || this.state === 'waiting' || this.state === 'showdown') {
      return 30;
    }
    const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
    return Math.max(0, this.turnTimeLeft - elapsed);
  }

  playerAction(playerId, action, amount = 0) {
    // Валидация входных данных
    if (typeof playerId !== 'string' || !playerId) {
      console.log('Некорректный playerId:', playerId);
      return false;
    }
    if (!['fold', 'call', 'raise'].includes(action)) {
      console.log('Некорректное действие:', action);
      return false;
    }
    if (action === 'raise' && (typeof amount !== 'number' || isNaN(amount) || amount <= 0)) {
      console.log('Некорректная сумма для рейза:', amount);
      return false;
    }
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.id !== this.players[this.currentPlayerIndex].id) return false;
    if (player.folded) return false;
    if (player.allIn) return false; // Игрок на all-in не может действовать

    switch (action) {
      case 'fold':
        player.folded = true;
        break;
      case 'call':
        const callAmountForCall = Math.min(this.currentBet - player.bet, player.chips);
        player.bet += callAmountForCall;
        player.chips -= callAmountForCall;
        this.pot += callAmountForCall;
        // Отслеживаем общую ставку за раздачу
        this.totalBetsThisHand.set(player.id, (this.totalBetsThisHand.get(player.id) || 0) + callAmountForCall);
        if (player.chips === 0) player.allIn = true;
        break;
      case 'raise':
        // Валидация входных данных
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
          console.log(`Некорректная сумма рейза: ${amount}`);
          return false;
        }
        
        // amount - это общая сумма ставки, которую хочет сделать игрок
        // Минимальный рейз = текущая ставка + размер последнего рейза (или big blind, если рейза не было)
        let minRaiseAmount;
        if (this.lastRaiseSize > 0) {
          // Если был рейз, минимальный рейз = currentBet + размер последнего рейза
          minRaiseAmount = this.currentBet + this.lastRaiseSize;
        } else {
          // Если рейза еще не было, минимальный рейз = currentBet + bigBlind
          minRaiseAmount = this.currentBet + this.bigBlind;
        }
        
        // Проверяем, что рейз больше или равен минимальному рейзу
        if (amount < minRaiseAmount) {
          console.log(`Рейз слишком мал: ${amount}, минимум: ${minRaiseAmount}, currentBet: ${this.currentBet}`);
          return false;
        }
        
        // Проверяем, что у игрока достаточно фишек
        const totalNeeded = amount - player.bet;
        if (totalNeeded > player.chips) {
          console.log(`Недостаточно фишек: нужно ${totalNeeded}, есть ${player.chips}`);
          return false;
        }
        
        // Вычисляем суммы
        const callAmountForRaise = Math.min(this.currentBet - player.bet, player.chips);
        const raiseAmount = amount - player.bet - callAmountForRaise;
        
        // Сначала колл до currentBet
        if (callAmountForRaise > 0) {
          player.bet += callAmountForRaise;
          player.chips -= callAmountForRaise;
          this.pot += callAmountForRaise;
          // Отслеживаем общую ставку за раздачу
          this.totalBetsThisHand.set(player.id, (this.totalBetsThisHand.get(player.id) || 0) + callAmountForRaise);
        }
        
        // Потом рейз сверх currentBet
        if (raiseAmount > 0) {
          player.bet += raiseAmount;
          player.chips -= raiseAmount;
          this.pot += raiseAmount;
          // Отслеживаем общую ставку за раздачу
          this.totalBetsThisHand.set(player.id, (this.totalBetsThisHand.get(player.id) || 0) + raiseAmount);
          const newBet = player.bet;
          const raiseSize = newBet - this.currentBet;
          this.currentBet = newBet;
          // Запоминаем, кто сделал рейз и размер рейза
          this.lastRaiseIndex = this.currentPlayerIndex;
          this.lastRaiseSize = raiseSize;
          console.log(`Игрок ${player.name} сделал рейз до ${this.currentBet} (размер рейза: ${raiseSize}), минимум был: ${minRaiseAmount}`);
        } else {
          // Если рейз не получился (amount слишком мал), откатываем колл
          if (callAmountForRaise > 0) {
            player.bet -= callAmountForRaise;
            player.chips += callAmountForRaise;
            this.pot -= callAmountForRaise;
            // Откатываем общую ставку за раздачу
            const currentTotal = this.totalBetsThisHand.get(player.id) || 0;
            this.totalBetsThisHand.set(player.id, Math.max(0, currentTotal - callAmountForRaise));
          }
          return false;
        }
        
        if (player.chips === 0) player.allIn = true;
        break;
    }
    
    // Обновляем прибыль
    player.profit = player.chips - player.totalBuyIn;

    // Проверяем, можем ли перейти к следующему раунду ПЕРЕД переходом к следующему игроку
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если остался один активный игрок, он выигрывает
    if (activePlayers.length <= 1) {
      this.nextPlayer();
      return true;
    }
    
    // Проверяем, что все ставки равны (или игроки на all-in)
    const allBetsEqual = activePlayers.every(p => 
      (p.bet === this.currentBet) || p.allIn || p.folded
    );
    
    // ВАЖНО: Если все активные игроки на all-in - сразу идём в showdown!
    if (this.allPlayersAllIn() && allBetsEqual) {
      console.log('Все игроки ALL-IN! Запускаем авто-раздачу до showdown...');
      this.runAllInShowdown();
      return true;
    }
    
    // Вычисляем следующий индекс игрока
    let nextIndex = this.currentPlayerIndex;
    let attempts = 0;
    do {
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
      if (attempts > this.players.length) break;
    } while (this.players[nextIndex].folded || this.players[nextIndex].allIn);
    
    // Если был рейз, проверяем, что следующий игрок - это тот, кто сделал рейз
    let shouldEndRound = false;
    if (this.lastRaiseIndex >= 0 && this.lastRaiseIndex < this.players.length) {
      // Раунд заканчивается, когда следующий ход - это игрок, который сделал рейз
      // И все ставки равны (то есть все уже ответили на рейз)
      if (nextIndex === this.lastRaiseIndex && allBetsEqual) {
        shouldEndRound = true;
      }
    } else {
      // Если не было рейза (первый раунд), проверяем, что все активные игроки уравняли ставки
      // И следующий игрок - это big blind
      const bigBlindIndex = (this.dealerIndex + 1) % this.players.length;
      if (nextIndex === bigBlindIndex && allBetsEqual) {
        shouldEndRound = true;
      }
    }
    
    if (shouldEndRound) {
      // Переходим к следующему раунду
      const roundChanged = this.nextRound();
      // Вызываем callback для проверки хода бота
      if (typeof this.onRoundChange === 'function') {
        this.onRoundChange();
      }
      // Также возвращаем roomId через специальное свойство для вызова checkBotMove
      return true;
    }
    
    // Переходим к следующему игроку
    this.nextPlayer();
    return true;
  }
  
  // Докупка фишек
  buyChips(playerId, amount) {
    if (!this.allowedBuyIn) return false;
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isBot) return false;
    
    player.chips += amount;
    player.totalBuyIn += amount;
    player.profit = player.chips - player.totalBuyIn;
    return true;
  }
  
  // Управление разрешением докупки (только админ)
  setBuyInAllowed(adminId, allowed) {
    if (adminId !== this.adminId) return false;
    this.allowedBuyIn = allowed;
    return true;
  }

  nextPlayer() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если остался один игрок, он выигрывает
    if (activePlayers.length <= 1) {
      const wonPot = this.pot;
      if (activePlayers.length === 1) {
        const winner = activePlayers[0];
        winner.chips += this.pot;
        winner.profit = winner.chips - winner.totalBuyIn;
        
        // Устанавливаем результаты игры для отображения
        this.gameResults = {
          winners: [{
            name: winner.name,
            oddsName: 'Все соперники сбросили карты',
            winAmount: wonPot,
            isBot: winner.isBot
          }],
          pot: wonPot,
          reason: 'fold',
          continueGame: true
        };
        
        console.log(`🏆 ${winner.name} выиграл ${wonPot} (соперники сбросили карты)`);
        this.pot = 0;
      }
      
      // Устанавливаем состояние showdown для показа результатов
      this.state = 'showdown';
      
      // Удаляем игроков с нулевыми фишками
      this.players = this.players.filter(p => {
        if (p.chips <= 0 && !p.isBot) {
          console.log(`Игрок ${p.name} выбыл из игры (нет фишек)`);
          return false;
        }
        return true;
      });
      
      // Обновляем индексы после удаления игроков
      if (this.dealerIndex >= this.players.length) {
        this.dealerIndex = 0;
      }
      
      this.turnStartTime = null;
      return;
    }

    // Переход к следующему активному игроку
    let attempts = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
      if (attempts > this.players.length) break;
    } while (this.players[this.currentPlayerIndex].folded || 
             this.players[this.currentPlayerIndex].allIn);

    // Запускаем таймер для нового хода
    this.startTurnTimer();
  }

  // Выполнение хода бота
  makeBotMove() {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot) return false;
    
    const decision = this.botDecision(currentPlayer);
    if (!decision) return false;
    
    // Небольшая задержка для реалистичности
    setTimeout(() => {
      this.playerAction(currentPlayer.id, decision.action, decision.amount || 0);
    }, 1000 + Math.random() * 1000);
    
    return true;
  }

  // Проверка, все ли активные игроки на all-in
  allPlayersAllIn() {
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length <= 1) return false;
    
    // Все активные игроки либо на all-in, либо остался только один с фишками
    const playersWithChips = activePlayers.filter(p => p.chips > 0 && !p.allIn);
    return playersWithChips.length <= 1;
  }

  // Автоматическая раздача всех карт при all-in
  runAllInShowdown() {
    console.log('ALL-IN Showdown! Текущее состояние:', this.state);
    
    // Раздаём карты до конца
    while (this.state !== 'showdown' && this.state !== 'waiting') {
      if (this.state === 'betting') {
        this.state = 'flop';
        for (let i = 0; i < 3; i++) {
          this.communityCards.push(this.deck.pop());
        }
        console.log('Флоп:', this.communityCards.slice(0, 3));
      } else if (this.state === 'flop') {
        this.state = 'turn';
        this.communityCards.push(this.deck.pop());
        console.log('Тёрн:', this.communityCards[3]);
      } else if (this.state === 'turn') {
        this.state = 'river';
        this.communityCards.push(this.deck.pop());
        console.log('Ривер:', this.communityCards[4]);
      } else if (this.state === 'river') {
        this.state = 'showdown';
        const results = this.evaluateHands();
        this.gameResults = results;
        console.log('Showdown! Результаты:', results);
        return results;
      }
    }
    
    // Если уже в showdown
    if (this.state === 'showdown') {
      return this.gameResults;
    }
    
    return null;
  }

  nextRound() {
    // Сбрасываем информацию о рейзах при переходе к новому раунду
    this.lastRaiseIndex = -1;
    this.lastRaiseSize = 0;
    
    if (this.state === 'betting') {
      this.state = 'flop';
      for (let i = 0; i < 3; i++) {
        this.communityCards.push(this.deck.pop());
      }
      this.resetBets();
    } else if (this.state === 'flop') {
      this.state = 'turn';
      this.communityCards.push(this.deck.pop());
      this.resetBets();
    } else if (this.state === 'turn') {
      this.state = 'river';
      this.communityCards.push(this.deck.pop());
      this.resetBets();
    } else if (this.state === 'river') {
      this.state = 'showdown';
      const results = this.evaluateHands();
      this.gameResults = results;
      
      if (results && results.continueGame) {
        this.autoStartNextHand = true;
      }
      return true;
    }
    
    // Если все на all-in - автоматически раздаём ВСЕ карты сразу
    if (this.allPlayersAllIn() && this.state !== 'showdown') {
      console.log('Все игроки на ALL-IN! Запускаем showdown...');
      this.runAllInShowdown();
    }
    
    return true;
  }

  resetBets() {
    this.players.forEach(p => p.bet = 0);
    this.currentBet = 0;
    this.lastRaiseIndex = -1; // Сбрасываем при новом раунде
    // Начинаем с дилера, но пропускаем сложенных игроков
    this.currentPlayerIndex = this.dealerIndex;
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.state = 'showdown';
      const results = this.evaluateHands();
      this.gameResults = results;
    } else {
      // Переходим к первому активному игроку после дилера
      let attempts = 0;
      while ((this.players[this.currentPlayerIndex].folded || 
              this.players[this.currentPlayerIndex].allIn) && 
             attempts < this.players.length) {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        attempts++;
      }
      // Запускаем таймер для нового раунда
      this.startTurnTimer();
    }
  }

  getHandName(rank) {
    if (rank >= 9000000) return 'Роял-флэш';
    if (rank >= 8000000) return 'Стрит-флэш';
    if (rank >= 7000000) return 'Каре';
    if (rank >= 6000000) return 'Фулл-хаус';
    if (rank >= 5000000) return 'Флэш';
    if (rank >= 4000000) return 'Стрит';
    if (rank >= 3000000) return 'Тройка';
    if (rank >= 2000000) return 'Две пары';
    if (rank >= 1000000) return 'Пара';
    return 'Старшая карта';
  }

  // Расчет side pots при all-in
  calculateSidePots() {
    // Используем общую сумму ставок за раздачу, а не только текущий раунд
    const allTotalBets = this.players.map(p => ({
      id: p.id,
      totalBet: this.totalBetsThisHand.get(p.id) || 0,
      folded: p.folded
    })).filter(b => b.totalBet > 0);
    
    if (allTotalBets.length === 0) return [];
    
    // Собираем все уникальные суммы ставок за раздачу
    const betAmounts = [...new Set(allTotalBets.map(b => b.totalBet))].sort((a, b) => a - b);
    const sidePots = [];

    for (let i = 0; i < betAmounts.length; i++) {
      const potLevel = betAmounts[i];
      const prevLevel = i > 0 ? betAmounts[i - 1] : 0;
      const levelContribution = potLevel - prevLevel;

      // Считаем, сколько игроков участвовало на этом уровне
      // Включаем всех игроков, которые поставили >= potLevel (даже если они спасовали)
      const playersAtLevel = allTotalBets.filter(b => b.totalBet >= potLevel);
      
      // Размер side pot = количество игроков на этом уровне * их вклад
      const potSize = playersAtLevel.length * levelContribution;

      if (potSize > 0) {
        sidePots.push({
          level: potLevel,
          size: potSize,
          eligiblePlayers: playersAtLevel.map(b => b.id)
        });
      }
    }

    return sidePots;
  }

  evaluateHands() {
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 0) return null;

    const hands = activePlayers.map(player => {
      const bestHand = this.getBestHand(player.cards, this.communityCards);
      const rank = this.getHandRank(bestHand);
      return {
        player,
        hand: bestHand,
        rank: rank,
        handName: this.getHandName(rank)
      };
    });

    hands.sort((a, b) => b.rank - a.rank);
    
    // Расчет side pots
    const sidePots = this.calculateSidePots();
    const winners = [];
    
    // Логируем для отладки
    console.log('=== EVALUATE HANDS ===');
    console.log('Total pot:', this.pot);
    console.log('Side pots:', sidePots);
    this.players.forEach(p => {
      const totalBet = this.totalBetsThisHand.get(p.id) || 0;
      console.log(`Player ${p.name}: totalBet=${totalBet}, currentBet=${p.bet}, chips=${p.chips}, folded=${p.folded}`);
    });
    
    if (sidePots.length > 0) {
      // Распределяем side pots
      for (const sidePot of sidePots) {
        // Находим лучшие руки среди игроков, имеющих право на этот pot
        const eligibleHands = hands.filter(h => 
          sidePot.eligiblePlayers.includes(h.player.id)
        );
        
        if (eligibleHands.length === 0) continue;
        
        // Находим максимальный ранг
        const maxRank = eligibleHands[0].rank;
        const winnersAtLevel = eligibleHands.filter(h => h.rank === maxRank);
        
        // Делим pot поровну между победителями
        const potPerWinner = Math.floor(sidePot.size / winnersAtLevel.length);
        const remainder = sidePot.size % winnersAtLevel.length;
        
        winnersAtLevel.forEach((winner, index) => {
          const chipsWon = potPerWinner + (index < remainder ? 1 : 0);
          winner.player.chips += chipsWon;
          winner.player.profit = winner.player.chips - winner.player.totalBuyIn;
          
          winners.push({
            player: winner.player,
            chipsWon: chipsWon,
            hand: winner.hand,
            handName: winner.handName,
            potLevel: sidePot.level
          });
        });
      }
    } else {
      // Обычный случай - нет all-in, один main pot
      const maxRank = hands[0].rank;
      const winnersAtLevel = hands.filter(h => h.rank === maxRank);
      
      // Делим pot поровну между победителями
      const potPerWinner = Math.floor(this.pot / winnersAtLevel.length);
      const remainder = this.pot % winnersAtLevel.length;
      
      winnersAtLevel.forEach((winner, index) => {
        const chipsWon = potPerWinner + (index < remainder ? 1 : 0);
        winner.player.chips += chipsWon;
        winner.player.profit = winner.player.chips - winner.player.totalBuyIn;
        
        winners.push({
          player: winner.player,
          chipsWon: chipsWon,
          hand: winner.hand,
          handName: winner.handName,
          potLevel: this.pot
        });
      });
    }
    
    this.pot = 0;

    // Обновляем прибыль всех игроков и статистику
    this.players.forEach(p => {
      const oldProfit = p.profit || 0;
      p.profit = p.chips - p.totalBuyIn;
      
      // Обновляем статистику
      if (!p.isBot && this.playerStats.has(p.id)) {
        const stats = this.playerStats.get(p.id);
        stats.handsPlayed++;
        if (p.profit > oldProfit) {
          stats.handsWon++;
          const winAmount = p.profit - oldProfit;
          if (winAmount > stats.biggestWin) {
            stats.biggestWin = winAmount;
          }
        } else if (p.profit < oldProfit) {
          const lossAmount = oldProfit - p.profit;
          if (lossAmount > stats.biggestLoss) {
            stats.biggestLoss = lossAmount;
          }
        }
        stats.totalProfit = p.profit;
      }
    });
    
    // Сохраняем историю раздачи
    this.handHistory.push({
      timestamp: Date.now(),
      winners: winners.map(w => ({
        name: w.player.name,
        chipsWon: w.chipsWon
      })),
      pot: sidePots.length > 0 ? sidePots.reduce((sum, pot) => sum + pot.size, 0) : this.pot,
      playersCount: activePlayers.length
    });
    
    // Ограничиваем историю последними 50 раздачами
    if (this.handHistory.length > 50) {
      this.handHistory.shift();
    }

    // Следующий дилер
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    
    // Удаляем игроков с нулевыми фишками
    this.players = this.players.filter(p => {
      if (p.chips <= 0 && !p.isBot) {
        console.log(`Игрок ${p.name} выбыл из игры (нет фишек)`);
        return false;
      }
      return true;
    });
    
    // Обновляем индексы после удаления игроков
    if (this.dealerIndex >= this.players.length) {
      this.dealerIndex = 0;
    }
    
    // Проверяем, можем ли продолжить игру
    const playersWithChips = this.players.filter(p => p.chips > 0);
    if (playersWithChips.length >= 2) {
      // Автоматически начинаем новую раздачу через 3 секунды (чтобы показать результаты)
      this.state = 'waiting';
      this.turnStartTime = null;
      // Флаг для автоматического старта новой раздачи
      this.autoStartNextHand = true;
    } else {
      // Недостаточно игроков - переходим в ожидание
      this.state = 'waiting';
      this.turnStartTime = null;
      this.autoStartNextHand = false;
      if (playersWithChips.length === 1) {
        console.log(`Игра окончена. Победитель: ${playersWithChips[0].name} с ${playersWithChips[0].chips} фишками`);
      }
    }

    // Возвращаем информацию о результатах
    return {
      winners: winners.map(w => ({
        name: w.player.name,
        id: w.player.id,
        hand: w.hand,
        handName: w.handName,
        chipsWon: w.chipsWon,
        potLevel: w.potLevel
      })),
      allHands: hands.map(h => ({
        playerName: h.player.name,
        playerId: h.player.id,
        hand: h.hand,
        handName: h.handName,
        rank: h.rank
      })),
      sidePots: sidePots,
      continueGame: playersWithChips.length >= 2
    };
  }

  getBestHand(playerCards, communityCards) {
    const allCards = [...playerCards, ...communityCards];
    if (allCards.length < 5) return [];
    
    const combinations = this.getCombinations(allCards, 5);
    let bestHand = combinations[0] || [];
    let bestRank = 0;

    for (let combo of combinations) {
      const rank = this.getHandRank(combo);
      if (rank > bestRank) {
        bestRank = rank;
        bestHand = combo;
      }
    }
    return bestHand;
  }

  getCombinations(cards, k) {
    if (k === 0) return [[]];
    if (cards.length === 0) return [];
    
    const [first, ...rest] = cards;
    const withFirst = this.getCombinations(rest, k - 1).map(combo => [first, ...combo]);
    const withoutFirst = this.getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  getHandRank(cards) {
    if (!cards || cards.length !== 5) return 0;
    const allCards = cards;

    const ranks = allCards.map(c => c.value).sort((a, b) => b - a);
    const suits = allCards.map(c => c.suit);
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.isStraight(ranks);

    // Royal Flush
    if (isFlush && isStraight && ranks[0] === 14 && ranks[4] === 10) return 9000000;
    // Straight Flush
    if (isFlush && isStraight) return 8000000 + ranks[0];
    // Four of a Kind
    if (counts[0] === 4) {
      const fourOfKindRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 4));
      const kicker = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 1));
      return 7000000 + fourOfKindRank * 100 + kicker;
    }
    // Full House
    if (counts[0] === 3 && counts[1] === 2) {
      const threeRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3));
      const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2));
      return 6000000 + threeRank * 100 + pairRank;
    }
    // Flush
    if (isFlush) {
      // Учитываем все карты для сравнения флешей
      let flushRank = 5000000;
      ranks.forEach((r, i) => {
        flushRank += r * Math.pow(100, 4 - i);
      });
      return flushRank;
    }
    // Straight
    if (isStraight) return 4000000 + ranks[0];
    // Three of a Kind
    if (counts[0] === 3) {
      const threeRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3));
      const kickers = Object.keys(rankCounts)
        .filter(k => rankCounts[k] === 1)
        .map(k => parseInt(k))
        .sort((a, b) => b - a);
      return 3000000 + threeRank * 10000 + kickers[0] * 100 + (kickers[1] || 0);
    }
    // Two Pair
    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = Object.keys(rankCounts)
        .filter(k => rankCounts[k] === 2)
        .map(k => parseInt(k))
        .sort((a, b) => b - a);
      const kicker = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 1));
      return 2000000 + pairs[0] * 10000 + pairs[1] * 100 + kicker;
    }
    // Pair
    if (counts[0] === 2) {
      const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2));
      const kickers = Object.keys(rankCounts)
        .filter(k => rankCounts[k] === 1)
        .map(k => parseInt(k))
        .sort((a, b) => b - a);
      return 1000000 + pairRank * 1000000 + kickers[0] * 10000 + kickers[1] * 100 + (kickers[2] || 0);
    }
    // High Card - учитываем все карты
    let highCardRank = 0;
    ranks.forEach((r, i) => {
      highCardRank += r * Math.pow(100, 4 - i);
    });
    return highCardRank;
  }

  isStraight(ranks) {
    const sorted = [...new Set(ranks)].sort((a, b) => b - a);
    if (sorted.length < 5) return false;
    for (let i = 0; i <= sorted.length - 5; i++) {
      let straight = true;
      for (let j = 1; j < 5; j++) {
        if (sorted[i + j] !== sorted[i] - j) {
          straight = false;
          break;
        }
      }
      if (straight) return true;
    }
    // A-2-3-4-5 straight
    if (sorted.includes(14) && sorted.includes(5) && sorted.includes(4) && 
        sorted.includes(3) && sorted.includes(2)) return true;
    return false;
  }

  getGameState() {
    const state = {
      players: this.players.map(p => {
        const playerData = {
          id: p.id,
          name: p.name,
          chips: p.chips,
          bet: p.bet,
          folded: p.folded,
          allIn: p.allIn,
          cards: p.cards,
          isBot: p.isBot,
          totalBuyIn: p.totalBuyIn,
          profit: p.profit
        };
        
        // Добавляем статистику, если есть
        if (this.playerStats.has(p.id)) {
          playerData.stats = this.playerStats.get(p.id);
        }
        
        return playerData;
      }),
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      state: this.state,
      dealerIndex: this.dealerIndex,
      timeLeft: this.getTimeLeft(),
      adminId: this.adminId,
      allowedBuyIn: this.allowedBuyIn,
      buyInAmount: this.buyInAmount,
      gameResults: this.gameResults,
      handHistory: this.handHistory.slice(-10),
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind,
      lastRaiseSize: this.lastRaiseSize // Добавляем для правильного расчета минимального рейза на клиенте
    };
    
    // Очищаем результаты после отправки
    if (this.gameResults) {
      this.gameResults = null;
    }
    
    return state;
  }
}

// Функция для получения списка всех комнат
function getRoomsList() {
  return Array.from(rooms.entries()).map(([roomId, game]) => ({
    roomId,
    playersCount: game.players.length,
    maxPlayers: 6,
    state: game.state,
    pot: game.pot,
    players: game.players.map(p => ({
      name: p.name,
      chips: p.chips,
      isBot: p.isBot,
      id: p.id
    })),
    adminId: game.adminId,
    adminName: game.players.find(p => p.id === game.adminId)?.name || 'Unknown'
  }));
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Отправляем список комнат при подключении
  socket.emit('roomsList', getRoomsList());

  socket.on('getRoomsList', () => {
    socket.emit('roomsList', getRoomsList());
  });

  socket.on('createRoom', (roomId) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new PokerGame(roomId, socket.id));
      // Уведомляем всех о новом списке комнат
      io.emit('roomsList', getRoomsList());
    }
    socket.join(roomId);
    socket.emit('roomJoined', roomId);
  });

  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    const game = rooms.get(roomId);
    
    if (!game) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (game.addPlayer(socket.id, playerName)) {
      socket.join(roomId);
      socket.emit('joinedRoom', roomId);
      
      // Автоматически добавляем бота, если игрок один
      if (game.players.length === 1 && !game.players.some(p => p.isBot)) {
        game.addBot();
      }
      
      io.to(roomId).emit('gameState', game.getGameState());
      // Обновляем список комнат для всех
      io.emit('roomsList', getRoomsList());
    } else {
      socket.emit('error', 'Cannot join room');
    }
  });

  socket.on('addBot', (roomId) => {
    const game = rooms.get(roomId);
    if (game && game.addBot()) {
      io.to(roomId).emit('gameState', game.getGameState());
      io.emit('roomsList', getRoomsList());
    }
  });

  // Следующая раздача (нажатие кнопки)
  socket.on('nextHand', (roomId) => {
    console.log('Запрос на следующую раздачу:', roomId);
    const game = rooms.get(roomId);
    if (!game) return;
    
    // Разрешаем новую раздачу из waiting или showdown
    if (game.state !== 'waiting' && game.state !== 'showdown') {
      console.log('Игра в процессе, игнорируем. Состояние:', game.state);
      return;
    }
    
    const playersWithChips = game.players.filter(p => p.chips > 0);
    if (playersWithChips.length < 2) {
      socket.emit('error', 'Недостаточно игроков с фишками');
      return;
    }
    
    game.dealCards();
    const state = game.getGameState();
    io.to(roomId).emit('gameState', state);
    
    game.onRoundChange = () => {
      setTimeout(() => { checkBotMove(roomId); }, 1000);
    };
    
    setTimeout(() => { checkBotMove(roomId); }, 500);
  });

  socket.on('startGame', (roomId) => {
    console.log('Получен запрос на начало игры в комнате:', roomId);
    const game = rooms.get(roomId);
    if (!game) {
      console.error('Комната не найдена:', roomId);
      socket.emit('error', 'Комната не найдена');
      return;
    }
    if (game.players.length < 2) {
      console.error('Недостаточно игроков:', game.players.length);
      socket.emit('error', 'Нужно минимум 2 игрока для начала игры');
      return;
    }
    console.log('Начинаем игру. Игроков:', game.players.length);
    game.dealCards();
    const state = game.getGameState();
    console.log('Состояние игры после раздачи:', state.state, 'Карт у игроков:', state.players.map(p => p.cards.length));
    io.to(roomId).emit('gameState', state);
    
    // Устанавливаем callback для смены раунда
    game.onRoundChange = () => {
      console.log('Раунд изменился, проверяем ход бота для комнаты:', roomId);
      setTimeout(() => {
        checkBotMove(roomId);
      }, 1500);
    };
    
    // Проверяем, нужно ли боту сделать ход
    setTimeout(() => {
      checkBotMove(roomId);
    }, 500);
    
    // Игра НЕ продолжается автоматически - игрок нажимает кнопку
    game.autoStartNextHand = false;
  });

  // Функция проверки готовности к новой раздаче (НЕ автоматическая)
  function checkReadyForNextHand(roomId) {
    const game = rooms.get(roomId);
    if (!game) return;
    
    // Просто отправляем состояние - игрок сам нажмёт "Следующая раздача"
    if (game.state === 'waiting') {
      io.to(roomId).emit('gameState', game.getGameState());
    }
  }

  socket.on('playerAction', (data) => {
    const { roomId, action, amount } = data;
    const game = rooms.get(roomId);
    
    if (game && game.playerAction(socket.id, action, amount)) {
      const state = game.getGameState();
      io.to(roomId).emit('gameState', state);
      
      // Отправляем состояние (без автостарта)
      checkReadyForNextHand(roomId);
      
      // Проверяем, нужно ли боту сделать ход
      setTimeout(() => {
        checkBotMove(roomId);
      }, 1500);
    }
  });

  socket.on('buyChips', (data) => {
    const { roomId, amount } = data;
    const game = rooms.get(roomId);
    
    if (game && game.buyChips(socket.id, amount)) {
      io.to(roomId).emit('gameState', game.getGameState());
    }
  });

  socket.on('setBuyInAllowed', (data) => {
    const { roomId, allowed } = data;
    const game = rooms.get(roomId);
    
    if (game && game.setBuyInAllowed(socket.id, allowed)) {
      io.to(roomId).emit('gameState', game.getGameState());
    }
  });

  // Функция для проверки и выполнения хода бота
  function checkBotMove(roomId) {
    const game = rooms.get(roomId);
    if (!game) {
      console.log('Игра не найдена для комнаты:', roomId);
      return;
    }
    
    if (game.state === 'waiting' || game.state === 'showdown') {
      // Если игра в состоянии waiting или showdown, проверяем, нужно ли начать новую раздачу
      if (game.state === 'waiting') {
        checkReadyForNextHand(roomId);
      }
      return;
    }
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    console.log('Проверка хода бота. Текущий игрок:', currentPlayer ? currentPlayer.name : 'не найден', 
                'Индекс:', game.currentPlayerIndex, 
                'Состояние:', game.state,
                'isBot:', currentPlayer ? currentPlayer.isBot : false);
    
    if (currentPlayer && currentPlayer.isBot && !currentPlayer.folded && !currentPlayer.allIn) {
      const decision = game.botDecision(currentPlayer);
      console.log('Решение бота:', decision);
      if (decision) {
        // Бот думает 1.5-2 секунды
        const delay = 1500 + Math.random() * 500;
        setTimeout(() => {
          const gameCheck = rooms.get(roomId);
          if (!gameCheck) return;
          const currentPlayerCheck = gameCheck.players[gameCheck.currentPlayerIndex];
          if (currentPlayerCheck && currentPlayerCheck.id === currentPlayer.id && 
              !currentPlayerCheck.folded && !currentPlayerCheck.allIn) {
            
            let success = gameCheck.playerAction(currentPlayer.id, decision.action, decision.amount || 0);
            
            // Если рейз не удался - делаем колл
            if (!success && decision.action === 'raise') {
              console.log('Рейз бота не удался, делаем колл');
              success = gameCheck.playerAction(currentPlayer.id, 'call', 0);
            }
            
            // Если колл тоже не удался - делаем фолд
            if (!success) {
              console.log('Колл бота не удался, делаем фолд');
              success = gameCheck.playerAction(currentPlayer.id, 'fold', 0);
            }
            
            if (success) {
              const state = gameCheck.getGameState();
              io.to(roomId).emit('gameState', state);
              checkReadyForNextHand(roomId);
              setTimeout(() => { checkBotMove(roomId); }, 800);
            } else {
              console.log('Бот не смог выполнить действие, пропускаем');
            }
          }
        }, delay);
      } else {
        // Если бот не может принять решение, пробуем еще раз через секунду
        console.log('Бот не может принять решение, пробуем еще раз');
        setTimeout(() => {
          checkBotMove(roomId);
        }, 1000);
      }
    }
  }

  // Таймер для отправки обновлений времени и проверки хода бота
  setInterval(() => {
    rooms.forEach((game, roomId) => {
      if (game.state !== 'waiting' && game.state !== 'showdown') {
        const timeLeft = game.getTimeLeft();
        if (timeLeft <= 0) {
          // Время вышло - автоматически пас
          const currentPlayer = game.players[game.currentPlayerIndex];
          if (currentPlayer && !currentPlayer.isBot && !currentPlayer.folded && !currentPlayer.allIn) {
            game.playerAction(currentPlayer.id, 'fold');
            const state = game.getGameState();
            io.to(roomId).emit('gameState', state);
            
            // Проверяем, нужно ли автоматически начать новую раздачу
            checkReadyForNextHand(roomId);
            
            setTimeout(() => {
              checkBotMove(roomId);
            }, 500);
          }
        } else {
          // Отправляем обновление времени
          io.to(roomId).emit('timeUpdate', { timeLeft, currentPlayerIndex: game.currentPlayerIndex });
        }
        
        // Периодически проверяем, нужно ли боту сделать ход
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isBot && !currentPlayer.folded && !currentPlayer.allIn) {
          // Проверяем, не застрял ли бот (если прошло больше 2 секунд с начала хода)
          const timeSinceTurnStart = Date.now() - (game.turnStartTime || 0);
          if (timeSinceTurnStart > 2000) {
            checkBotMove(roomId);
          }
        }
      }
    });
  }, 1000);

  // ====== BLACK JACK ======
  socket.on('blackjack-join', (data) => {
    const { playerName } = data;
    if (!playerName) {
      socket.emit('blackjack-error', 'Введите ваше имя');
      return;
    }
    
    // Создаем или получаем игру
    let game = blackjackGames.get(socket.id);
    if (!game) {
      game = new BlackJackGame(socket.id, playerName);
      blackjackGames.set(socket.id, game);
    }
    
    socket.emit('blackjack-state', game.getGameState());
  });

  socket.on('blackjack-bet', (data) => {
    const { amount } = data;
    const game = blackjackGames.get(socket.id);
    
    if (!game) {
      socket.emit('blackjack-error', 'Игра не найдена');
      return;
    }
    
    if (game.placeBet(amount)) {
      socket.emit('blackjack-state', game.getGameState());
    } else {
      socket.emit('blackjack-error', 'Неверная ставка');
    }
  });

  socket.on('blackjack-hit', () => {
    const game = blackjackGames.get(socket.id);
    if (!game) {
      socket.emit('blackjack-error', 'Игра не найдена');
      return;
    }
    
    game.hit();
    socket.emit('blackjack-state', game.getGameState());
  });

  socket.on('blackjack-stand', () => {
    const game = blackjackGames.get(socket.id);
    if (!game) {
      socket.emit('blackjack-error', 'Игра не найдена');
      return;
    }
    
    game.stand();
    socket.emit('blackjack-state', game.getGameState());
  });

  socket.on('blackjack-double', () => {
    const game = blackjackGames.get(socket.id);
    if (!game) {
      socket.emit('blackjack-error', 'Игра не найдена');
      return;
    }
    
    if (game.doubleDown()) {
      socket.emit('blackjack-state', game.getGameState());
    } else {
      socket.emit('blackjack-error', 'Нельзя удвоить ставку');
    }
  });

  socket.on('blackjack-new-game', () => {
    const game = blackjackGames.get(socket.id);
    if (!game) {
      socket.emit('blackjack-error', 'Игра не найдена');
      return;
    }
    
    game.newGame();
    socket.emit('blackjack-state', game.getGameState());
  });

  // ====== МОНЕТКА ======
  socket.on('coinflip-join', (data) => {
    const { playerName } = data;
    if (!playerName) {
      socket.emit('coinflip-error', 'Введите ваше имя');
      return;
    }
    
    let game = coinflipGames.get(socket.id);
    if (!game) {
      game = new CoinFlipGame(socket.id, playerName);
      coinflipGames.set(socket.id, game);
    }
    
    socket.emit('coinflip-state', game.getGameState());
  });

  socket.on('coinflip-bet', (data) => {
    const { amount, choice } = data;
    const game = coinflipGames.get(socket.id);
    
    if (!game) {
      socket.emit('coinflip-error', 'Игра не найдена');
      return;
    }
    
    if (game.placeBet(amount, choice)) {
      // Отправляем состояние сразу
      socket.emit('coinflip-state', game.getGameState());
      
      // Отправляем результат после подбрасывания
      setTimeout(() => {
        socket.emit('coinflip-state', game.getGameState());
      }, 2000);
    } else {
      socket.emit('coinflip-error', 'Неверная ставка');
    }
  });

  socket.on('coinflip-new-game', () => {
    const game = coinflipGames.get(socket.id);
    if (!game) {
      socket.emit('coinflip-error', 'Игра не найдена');
      return;
    }
    
    game.newGame();
    socket.emit('coinflip-state', game.getGameState());
  });

  // ====== СЛОТ-МАШИНА ======
  socket.on('slots-join', (data) => {
    const { playerName } = data;
    if (!playerName) {
      socket.emit('slots-error', 'Введите ваше имя');
      return;
    }
    
    let game = slotsGames.get(socket.id);
    if (!game) {
      game = new SlotsGame(socket.id, playerName);
      slotsGames.set(socket.id, game);
    }
    
    socket.emit('slots-state', game.getGameState());
  });

  socket.on('slots-bet', (data) => {
    const { amount } = data;
    const game = slotsGames.get(socket.id);
    
    if (!game) {
      socket.emit('slots-error', 'Игра не найдена');
      return;
    }
    
    if (game.placeBet(amount)) {
      // Отправляем состояние сразу (spinning)
      socket.emit('slots-state', game.getGameState());
      
      // Отправляем результат после кручения
      setTimeout(() => {
        socket.emit('slots-state', game.getGameState());
      }, 3000);
    } else {
      socket.emit('slots-error', 'Неверная ставка');
    }
  });

  socket.on('slots-new-game', () => {
    const game = slotsGames.get(socket.id);
    if (!game) {
      socket.emit('slots-error', 'Игра не найдена');
      return;
    }
    
    game.newGame();
    socket.emit('slots-state', game.getGameState());
  });

  // Закрытие комнаты (только админ)
  socket.on('closeRoom', (roomId) => {
    const game = rooms.get(roomId);
    if (!game) {
      socket.emit('error', 'Комната не найдена');
      return;
    }
    
    // Проверяем, является ли пользователь админом
    if (game.adminId !== socket.id) {
      socket.emit('error', 'Только админ может закрыть стол');
      return;
    }
    
    // Уведомляем всех игроков в комнате о закрытии
    io.to(roomId).emit('roomClosed', { roomId, message: 'Стол закрыт администратором' });
    
    // Удаляем комнату
    rooms.delete(roomId);
    
    // Очищаем таймеры комнаты, если есть
    if (roomTimers.has(roomId)) {
      clearInterval(roomTimers.get(roomId));
      roomTimers.delete(roomId);
    }
    
    // Обновляем список комнат для всех
    io.emit('roomsList', getRoomsList());
    
    console.log(`Комната ${roomId} закрыта администратором ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Удаляем игры при отключении
    blackjackGames.delete(socket.id);
    coinflipGames.delete(socket.id);
    slotsGames.delete(socket.id);
    
    rooms.forEach((game, roomId) => {
      const player = game.players.find(p => p.id === socket.id);
      if (player) {
        // Если игрок отключился во время игры, он автоматически пасует
        if (game.state !== 'waiting' && game.state !== 'showdown' && !player.folded) {
          player.folded = true;
          // Если это был текущий игрок, переходим к следующему
          if (game.currentPlayerIndex < game.players.length && 
              game.players[game.currentPlayerIndex] && 
              game.players[game.currentPlayerIndex].id === socket.id) {
            game.nextPlayer();
          }
        }
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('gameState', game.getGameState());
        }
        // Обновляем список комнат
        io.emit('roomsList', getRoomsList());
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Слушаем на всех интерфейсах
server.listen(PORT, HOST, () => {
  console.log(`🚀 Poker server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`🌐 Public: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  } else if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`🌐 Public: ${process.env.RENDER_EXTERNAL_URL}`);
  } else {
    console.log(`🌐 Share your public IP/domain with friends!`);
  }
});

