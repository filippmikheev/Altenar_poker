const socket = io();
let currentRoomId = null;
let playerId = null;
let gameState = null;
let isMyTurn = false;

// Обработка ошибок подключения
socket.on('connect', () => {
    console.log('Подключено к серверу');
    playerId = socket.id;
});

socket.on('connect_error', (error) => {
    console.error('Ошибка подключения:', error);
    alert('Не удалось подключиться к серверу. Убедитесь, что сервер запущен.');
});

socket.on('disconnect', () => {
    console.log('Отключено от сервера');
});

// Элементы интерфейса
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomId');
const joinBtn = document.getElementById('joinBtn');
const createBtn = document.getElementById('createBtn');
const roomInfo = document.getElementById('roomInfo');
const roomNameSpan = document.getElementById('roomName');
const potAmount = document.getElementById('potAmount');
const communityCardsDiv = document.getElementById('communityCards');
const playersContainer = document.getElementById('playersContainer');
const playerHand = document.getElementById('playerHand');
const playerChips = document.getElementById('playerChips');
const playerBet = document.getElementById('playerBet');
const foldBtn = document.getElementById('foldBtn');
const callBtn = document.getElementById('callBtn');
const raiseAmount = document.getElementById('raiseAmount');
const raiseBtn = document.getElementById('raiseBtn');
const allInBtn = document.getElementById('allInBtn');
const startGameBtn = document.getElementById('startGameBtn');
const nextHandBtn = document.getElementById('nextHandBtn');
const addBotBtn = document.getElementById('addBotBtn');
const timerDisplay = document.getElementById('timerDisplay');
const timeLeftSpan = document.getElementById('timeLeft');
const playerBuyIn = document.getElementById('playerBuyIn');
const playerProfit = document.getElementById('playerProfit');
// Компактные элементы
const playerChipsCompact = document.getElementById('playerChipsCompact');
const playerBetCompact = document.getElementById('playerBetCompact');
const playerProfitCompact = document.getElementById('playerProfitCompact');
// Сворачиваемая таблица лидеров
const leaderboardHeader = document.getElementById('leaderboardHeader');
const leaderboardContent = document.getElementById('leaderboardContent');
const buyInControls = document.getElementById('buyInControls');
const buyInAmountInput = document.getElementById('buyInAmount');
const buyChipsBtn = document.getElementById('buyChipsBtn');
const adminControls = document.getElementById('adminControls');
const allowBuyInCheck = document.getElementById('allowBuyInCheck');
const roomsTabBtn = document.getElementById('roomsTabBtn');
const joinTabBtn = document.getElementById('joinTabBtn');
const roomsTab = document.getElementById('roomsTab');
const joinTab = document.getElementById('joinTab');
const roomsList = document.getElementById('roomsList');
const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');

let timeLeft = 15;
let timerInterval = null;

// Добавление бота
if (addBotBtn) {
    addBotBtn.addEventListener('click', () => {
        socket.emit('addBot', currentRoomId);
    });
}

// Докупка фишек
if (buyChipsBtn && buyInAmountInput) {
    buyChipsBtn.addEventListener('click', () => {
        const amount = parseInt(buyInAmountInput.value);
        if (amount > 0) {
            socket.emit('buyChips', { roomId: currentRoomId, amount });
            buyInAmountInput.value = '';
        }
    });
}

// Управление разрешением докупки (админ)
if (allowBuyInCheck) {
    allowBuyInCheck.addEventListener('change', () => {
        socket.emit('setBuyInAllowed', { 
            roomId: currentRoomId, 
            allowed: allowBuyInCheck.checked 
        });
    });
}

// Переключение вкладок
if (roomsTabBtn && joinTabBtn && roomsTab && joinTab) {
    roomsTabBtn.addEventListener('click', () => {
        roomsTabBtn.classList.add('active');
        joinTabBtn.classList.remove('active');
        roomsTab.classList.add('active');
        joinTab.classList.remove('active');
        socket.emit('getRoomsList');
    });

    joinTabBtn.addEventListener('click', () => {
        joinTabBtn.classList.add('active');
        roomsTabBtn.classList.remove('active');
        joinTab.classList.add('active');
        roomsTab.classList.remove('active');
    });
}

if (refreshRoomsBtn) {
    refreshRoomsBtn.addEventListener('click', () => {
        socket.emit('getRoomsList');
    });
}

// Создание комнаты
if (createBtn && playerNameInput) {
    createBtn.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (!name) {
            alert('Введите ваше имя');
            return;
        }
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        socket.emit('createRoom', roomId);
        socket.emit('joinRoom', { roomId, playerName: name });
        currentRoomId = roomId;
        playerId = socket.id;
    });
}

// Тестовые игроки (дополнительные сокеты)
const testPlayers = [];
const TEST_PLAYER_DELAY = 15000; // 15 секунд
const TEST_PLAYER_NAMES = ['Алекс', 'Макс', 'Виктор', 'Дмитрий'];

// Создание тестового стола
const createTestTableBtn = document.getElementById('createTestTableBtn');
const createTestTableBtnFromRooms = document.getElementById('createTestTableBtnFromRooms');
const testTableModal = document.getElementById('testTableModal');
const testPlayersCountInput = document.getElementById('testPlayersCount');
const addAIBotCheckbox = document.getElementById('addAIBot');
const testStartingChipsInput = document.getElementById('testStartingChips');
const createTestTableConfirmBtn = document.getElementById('createTestTableConfirmBtn');
const cancelTestTableBtn = document.getElementById('cancelTestTableBtn');

function openTestTableModal() {
    const name = playerNameInput ? playerNameInput.value.trim() : '';
    if (!name) {
        // Если имя не введено, переключаемся на таб "Присоединиться"
        const joinTabBtn = document.getElementById('joinTabBtn');
        const roomsTabBtn = document.getElementById('roomsTabBtn');
        const joinTab = document.getElementById('joinTab');
        const roomsTab = document.getElementById('roomsTab');
        
        if (joinTabBtn && roomsTabBtn && joinTab && roomsTab) {
            roomsTabBtn.classList.remove('active');
            joinTabBtn.classList.add('active');
            roomsTab.classList.remove('active');
            joinTab.classList.add('active');
            alert('Введите ваше имя в поле выше, затем нажмите "🧪 Создать тестовый стол"');
            if (playerNameInput) {
                playerNameInput.focus();
            }
        } else {
            alert('Введите ваше имя');
        }
        return;
    }
    if (testTableModal) {
        testTableModal.style.display = 'flex';
    }
}

if (createTestTableBtn) {
    createTestTableBtn.addEventListener('click', openTestTableModal);
}

if (createTestTableBtnFromRooms) {
    createTestTableBtnFromRooms.addEventListener('click', openTestTableModal);
}

if (cancelTestTableBtn) {
    cancelTestTableBtn.addEventListener('click', () => {
        testTableModal.style.display = 'none';
    });
}

// Закрытие модального окна при клике вне его
if (testTableModal) {
    testTableModal.addEventListener('click', (e) => {
        if (e.target === testTableModal) {
            testTableModal.style.display = 'none';
        }
    });
}

if (createTestTableConfirmBtn) {
    createTestTableConfirmBtn.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (!name) {
            alert('Введите ваше имя');
            return;
        }
        
        const testPlayersCount = parseInt(testPlayersCountInput.value) || 0;
        const addAIBot = addAIBotCheckbox.checked;
        const startingChips = parseInt(testStartingChipsInput.value) || 1000;
        
        // Создаём комнату
        const roomId = 'TEST-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        socket.emit('createRoom', roomId);
        
        setTimeout(() => {
            socket.emit('joinRoom', { roomId, playerName: name });
            currentRoomId = roomId;
            playerId = socket.id;
            
            // Добавляем бота
            if (addAIBot) {
                setTimeout(() => {
                    socket.emit('addBot', roomId);
                    console.log('🤖 Добавлен ИИ-бот');
                }, 500);
            }
            
            // Создаём тестовых игроков
            for (let i = 0; i < testPlayersCount; i++) {
                setTimeout(() => {
                    createTestPlayer(roomId, TEST_PLAYER_NAMES[i] || `Тестер-${i+1}`, startingChips);
                }, 1000 + i * 500);
            }
            
            testTableModal.style.display = 'none';
        }, 300);
    });
}

// Функция создания тестового игрока
function createTestPlayer(roomId, playerName, startingChips) {
    const testSocket = io();
    const testPlayer = {
        socket: testSocket,
        name: playerName,
        id: null,
        thinkingTimeout: null
    };
    
    testSocket.on('connect', () => {
        testPlayer.id = testSocket.id;
        console.log(`👤 ${playerName} подключился`);
        testSocket.emit('joinRoom', { roomId, playerName });
    });
    
    testSocket.on('gameState', (state) => {
        // Проверяем, наш ли ход
        if (!state.players || state.currentPlayerIndex === undefined) return;
        const current = state.players[state.currentPlayerIndex];
        if (!current || current.id !== testPlayer.id) return;
        if (current.folded || current.allIn) return;
        if (state.state === 'waiting' || state.state === 'showdown') return;
        
        // Отменяем предыдущий таймаут
        if (testPlayer.thinkingTimeout) {
            clearTimeout(testPlayer.thinkingTimeout);
        }
        
        // Думаем 15 секунд
        console.log(`⏳ ${playerName} думает... (15 сек)`);
        testPlayer.thinkingTimeout = setTimeout(() => {
            // Случайное действие
            const actions = ['call', 'call', 'call', 'raise', 'fold'];
            const action = actions[Math.floor(Math.random() * actions.length)];
            
            if (action === 'raise') {
                const minRaise = state.currentBet + (state.lastRaiseSize || state.bigBlind || 20);
                const myPlayer = state.players.find(p => p.id === testPlayer.id);
                if (myPlayer) {
                    const amount = Math.min(minRaise + 50, myPlayer.chips + myPlayer.bet);
                    testSocket.emit('playerAction', { roomId, action: 'raise', amount });
                    console.log(`👤 ${playerName}: РЕЙЗ ${amount}`);
                }
            } else {
                testSocket.emit('playerAction', { roomId, action });
                console.log(`👤 ${playerName}: ${action === 'fold' ? 'ПАС' : 'КОЛЛ'}`);
            }
        }, TEST_PLAYER_DELAY);
    });
    
    testPlayers.push(testPlayer);
    return testPlayer;
}

// Присоединение к комнате
if (joinBtn && playerNameInput && roomIdInput) {
    joinBtn.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (!name) {
            alert('Введите ваше имя');
            return;
        }
        const roomId = roomIdInput.value.trim().toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase();
        socket.emit('joinRoom', { roomId, playerName: name });
        currentRoomId = roomId;
        playerId = socket.id;
    });
}

// Начало игры
if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
        if (!currentRoomId) {
            alert('Ошибка: не выбрана комната');
            return;
        }
        console.log('Запуск игры в комнате:', currentRoomId);
        socket.emit('startGame', currentRoomId);
    });
}

// Следующая раздача
if (nextHandBtn) {
    nextHandBtn.addEventListener('click', () => {
        if (!currentRoomId) return;
        console.log('Следующая раздача в комнате:', currentRoomId);
        socket.emit('nextHand', currentRoomId);
    });
}

// Действия игрока
if (foldBtn) {
    foldBtn.addEventListener('click', () => {
        if (isMyTurn && currentRoomId) {
            socket.emit('playerAction', { roomId: currentRoomId, action: 'fold' });
        }
    });
}

if (callBtn) {
    callBtn.addEventListener('click', () => {
        if (isMyTurn && currentRoomId) {
            socket.emit('playerAction', { roomId: currentRoomId, action: 'call' });
        }
    });
}

// All-in
if (allInBtn) {
    allInBtn.addEventListener('click', () => {
        if (isMyTurn && currentRoomId && gameState) {
            const myPlayer = gameState.players ? gameState.players.find(p => p.id === playerId) : null;
            if (myPlayer && myPlayer.chips > 0) {
                const allInAmount = myPlayer.chips + myPlayer.bet;
                console.log('ALL-IN:', allInAmount);
                socket.emit('playerAction', { roomId: currentRoomId, action: 'raise', amount: allInAmount });
            }
        }
    });
}

if (raiseBtn && raiseAmount) {
    raiseBtn.addEventListener('click', () => {
        if (isMyTurn && currentRoomId && gameState) {
            const amount = parseInt(raiseAmount.value);
            if (!amount || amount <= 0 || isNaN(amount)) {
                alert('Введите корректную сумму для рейза');
                raiseAmount.focus();
                return;
            }
            
            const currentBet = gameState.currentBet || 0;
            const myPlayer = gameState.players ? gameState.players.find(p => p.id === playerId) : null;
            if (!myPlayer) {
                alert('Ошибка: игрок не найден');
                return;
            }
            
            const myBet = myPlayer.bet || 0;
            const bigBlind = gameState.bigBlind || 20;
            const lastRaiseSize = gameState.lastRaiseSize || bigBlind;
            const minRaise = currentBet + Math.max(lastRaiseSize, bigBlind);
            
            if (amount < minRaise) {
                alert(`Минимальный рейз: ${minRaise} фишек`);
                raiseAmount.value = minRaise;
                raiseAmount.focus();
                return;
            }
            
            const totalNeeded = amount - myBet;
            if (totalNeeded > myPlayer.chips) {
                alert(`Недостаточно фишек. У вас: ${myPlayer.chips}, нужно: ${totalNeeded}`);
                raiseAmount.value = myPlayer.chips + myBet;
                raiseAmount.focus();
                return;
            }
            
            console.log('Отправка рейза:', { amount, currentBet, myBet, minRaise });
            socket.emit('playerAction', { roomId: currentRoomId, action: 'raise', amount });
            raiseAmount.value = '';
        } else if (!isMyTurn) {
            alert('Сейчас не ваш ход');
        }
    });
    
    // Автозаполнение минимального рейза при фокусе
    if (raiseAmount) {
        raiseAmount.addEventListener('focus', () => {
            if (gameState && gameState.currentBet !== undefined) {
                const currentBet = gameState.currentBet || 0;
                const bigBlind = gameState.bigBlind || 20;
                const lastRaiseSize = gameState.lastRaiseSize || bigBlind;
                const minRaise = currentBet + Math.max(lastRaiseSize, bigBlind);
                raiseAmount.placeholder = `Мин: ${minRaise}`;
            }
        });
    }
}

// Обработчики событий Socket.IO
socket.on('joinedRoom', (roomId) => {
    if (lobbyScreen) lobbyScreen.style.display = 'none';
    if (gameScreen) gameScreen.style.display = 'block';
    if (roomNameSpan) roomNameSpan.textContent = roomId;
    if (roomInfo) roomInfo.textContent = `Комната: ${roomId} — поделитесь этим ID с друзьями!`;
    playerId = socket.id;
    console.log('Присоединен к комнате:', roomId, 'Player ID:', playerId);
});

socket.on('gameState', (state) => {
    console.log('Получено состояние игры:', {
        state: state.state,
        players: state.players ? state.players.length : 0,
        pot: state.pot,
        communityCards: state.communityCards ? state.communityCards.length : 0,
        currentPlayerIndex: state.currentPlayerIndex,
        dealerIndex: state.dealerIndex
    });
    gameState = state;
    updateGameDisplay();
    
    // Показываем результаты игры, если они есть
    if (state.gameResults) {
        showGameResults(state.gameResults);
    }
});

socket.on('timeUpdate', (data) => {
    if (data.currentPlayerIndex === gameState?.currentPlayerIndex) {
        timeLeft = data.timeLeft;
        updateTimer();
    }
});

socket.on('error', (message) => {
    console.error('Ошибка сервера:', message);
    alert('Ошибка: ' + message);
});

socket.on('roomClosed', (data) => {
    console.log('Комната закрыта:', data);
    if (currentRoomId === data.roomId) {
        alert(data.message || 'Стол был закрыт администратором');
        // Возвращаемся в лобби
        if (lobbyScreen) lobbyScreen.style.display = 'block';
        if (gameScreen) gameScreen.style.display = 'none';
        currentRoomId = null;
        // Обновляем список комнат
        socket.emit('getRoomsList');
    }
});

socket.on('roomsList', (rooms) => {
    updateRoomsList(rooms);
});

// Обновление списка комнат
function updateRoomsList(rooms) {
    if (!roomsList) return;
    
    if (!rooms || rooms.length === 0) {
        roomsList.innerHTML = '<div class="no-rooms">Нет активных столов. Создайте новый!</div>';
        return;
    }
    
    roomsList.innerHTML = rooms.map(room => {
        const stateText = {
            'waiting': '⏳ Ожидание',
            'betting': '🃏 Префлоп',
            'flop': '🎴 Флоп',
            'turn': '🎴 Тёрн',
            'river': '🎴 Ривер',
            'showdown': '🏆 Вскрытие'
        }[room.state] || room.state;
        
        const playersList = room.players.map(p => 
            `${p.name}${p.isBot ? ' 🤖' : ''} (${p.chips})`
        ).join(', ');
        
        // Проверяем, является ли текущий пользователь админом этой комнаты
        const isAdmin = room.adminId === playerId;
        
        return `
            <div class="room-card">
                <div class="room-header">
                    <h3>🎰 ${room.roomId}</h3>
                    <span class="room-state ${room.state}">${stateText}</span>
                </div>
                <div class="room-info-card">
                    <div class="room-details">
                        <div><strong>Админ:</strong> <span>${room.adminName}</span></div>
                        <div><strong>Игроки:</strong> <span>${room.playersCount}/${room.maxPlayers}</span></div>
                        <div><strong>Банк:</strong> <span>${room.pot} фишек</span></div>
                    </div>
                    <div class="room-players">
                        <strong>За столом:</strong> ${playersList || 'Пусто'}
                    </div>
                </div>
                <div class="room-actions">
                    <button class="join-room-btn" data-room-id="${room.roomId}">
                        🚀 Присоединиться
                    </button>
                    ${isAdmin ? `
                        <button class="close-room-btn" data-room-id="${room.roomId}" title="Закрыть стол">
                            ❌ Закрыть
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Добавляем обработчики для кнопок присоединения
    roomsList.querySelectorAll('.join-room-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const roomId = btn.getAttribute('data-room-id');
            const name = playerNameInput?.value.trim() || prompt('Введите ваше имя:');
            if (name) {
                if (playerNameInput) playerNameInput.value = name;
                if (roomIdInput) roomIdInput.value = roomId;
                socket.emit('joinRoom', { roomId, playerName: name });
                currentRoomId = roomId;
            }
        });
    });
    
    // Добавляем обработчики для кнопок закрытия комнаты
    roomsList.querySelectorAll('.close-room-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const roomId = btn.getAttribute('data-room-id');
            if (confirm(`Вы уверены, что хотите закрыть стол "${roomId}"? Все игроки будут отключены.`)) {
                socket.emit('closeRoom', roomId);
            }
        });
    });
}

// Обновление таймера
function updateTimer() {
    if (!timerDisplay || !timeLeftSpan) return;
    
    if (gameState && gameState.state !== 'waiting' && gameState.state !== 'showdown') {
        const currentPlayer = gameState.players[gameState.currentPlayerIndex];
        const isCurrentPlayerTurn = currentPlayer && currentPlayer.id === playerId;
        
        if (isCurrentPlayerTurn) {
            timeLeftSpan.textContent = timeLeft;
            timerDisplay.style.display = 'block';
            
            if (timeLeft <= 5) {
                timerDisplay.style.color = '#ff6b6b';
                timerDisplay.style.animation = 'pulse 0.5s infinite';
            } else if (timeLeft <= 10) {
                timerDisplay.style.color = '#ffa500';
                timerDisplay.style.animation = 'none';
            } else {
                timerDisplay.style.color = '#fff';
                timerDisplay.style.animation = 'none';
            }
        } else {
            timerDisplay.style.display = 'none';
        }
    } else {
        timerDisplay.style.display = 'none';
    }
}

// Запуск таймера
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (gameState && gameState.state !== 'waiting' && gameState.state !== 'showdown') {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimer();
            }
        } else {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }, 1000);
}

// Позиции игроков вокруг стола (для 2-6 игроков)
function getPlayerPositions(totalPlayers) {
    const positions = {
        2: [
            { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
            { top: '5%', left: '50%', transform: 'translateX(-50%)' }
        ],
        3: [
            { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
            { top: '25%', left: '5%', transform: 'none' },
            { top: '25%', right: '5%', transform: 'none' }
        ],
        4: [
            { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
            { top: '50%', left: '3%', transform: 'translateY(-50%)' },
            { top: '5%', left: '50%', transform: 'translateX(-50%)' },
            { top: '50%', right: '3%', transform: 'translateY(-50%)' }
        ],
        5: [
            { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
            { bottom: '25%', left: '5%', transform: 'none' },
            { top: '10%', left: '20%', transform: 'none' },
            { top: '10%', right: '20%', transform: 'none' },
            { bottom: '25%', right: '5%', transform: 'none' }
        ],
        6: [
            { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
            { bottom: '30%', left: '3%', transform: 'none' },
            { top: '15%', left: '10%', transform: 'none' },
            { top: '5%', left: '50%', transform: 'translateX(-50%)' },
            { top: '15%', right: '10%', transform: 'none' },
            { bottom: '30%', right: '3%', transform: 'none' }
        ]
    };
    return positions[totalPlayers] || positions[6];
}

// Обновление отображения игры
function updateGameDisplay() {
    if (!gameState) return;

    // Банк
    if (potAmount) potAmount.textContent = gameState.pot;
    const potValue = document.getElementById('potValue');
    if (potValue) {
        const oldValue = parseInt(potValue.textContent) || 0;
        potValue.textContent = gameState.pot;
        if (oldValue !== gameState.pot && gameState.pot > 0) {
            potValue.style.animation = 'none';
            setTimeout(() => { potValue.style.animation = 'pulse 0.5s'; }, 10);
        }
    }

    // Общие карты с анимацией
    if (communityCardsDiv) {
        const currentCards = communityCardsDiv.children.length;
        const newCardsCount = gameState.communityCards ? gameState.communityCards.length : 0;
        
        if (currentCards !== newCardsCount) {
            communityCardsDiv.innerHTML = '';
            if (gameState.communityCards) {
                gameState.communityCards.forEach((card, index) => {
                    const cardEl = createCardElement(card);
                    cardEl.style.animationDelay = `${index * 0.1}s`;
                    communityCardsDiv.appendChild(cardEl);
                });
            }
        }
    }

    // Игроки
    if (!playersContainer || !gameState.players || !Array.isArray(gameState.players)) return;
    playersContainer.innerHTML = '';
    
    const positions = getPlayerPositions(gameState.players.length);
    
    gameState.players.forEach((player, index) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-seat';
        
        // Применяем позицию
        const pos = positions[index] || {};
        Object.keys(pos).forEach(key => {
            playerDiv.style[key] = pos[key];
        });
        
        if (index === gameState.currentPlayerIndex && gameState.state !== 'waiting' && gameState.state !== 'showdown') {
            playerDiv.classList.add('active');
        }
        if (index === gameState.dealerIndex) {
            playerDiv.classList.add('dealer');
        }
        if (player.folded) {
            playerDiv.classList.add('folded');
        }
        if (player.isBot) {
            playerDiv.classList.add('bot-player');
        }

        const isCurrentPlayer = player.id === playerId;
        
        // Имя игрока
        const nameDiv = document.createElement('div');
        nameDiv.className = 'player-name';
        let nameText = player.name;
        if (isCurrentPlayer) nameText += ' (Вы)';
        if (player.isBot) nameText += ' 🤖';
        nameDiv.textContent = nameText;
        playerDiv.appendChild(nameDiv);
        
        // Индикаторы блайндов
        const smallBlindIndex = gameState.dealerIndex;
        const bigBlindIndex = (gameState.dealerIndex + 1) % gameState.players.length;
        
        if (index === smallBlindIndex && gameState.state !== 'waiting') {
            const sbIndicator = document.createElement('div');
            sbIndicator.className = 'blind-indicator sb';
            sbIndicator.textContent = 'SB';
            sbIndicator.title = 'Small Blind';
            playerDiv.appendChild(sbIndicator);
        }
        if (index === bigBlindIndex && gameState.state !== 'waiting') {
            const bbIndicator = document.createElement('div');
            bbIndicator.className = 'blind-indicator bb';
            bbIndicator.textContent = 'BB';
            bbIndicator.title = 'Big Blind';
            playerDiv.appendChild(bbIndicator);
        }

        // Фишки
        const chipsDiv = document.createElement('div');
        chipsDiv.className = 'player-chips';
        chipsDiv.innerHTML = `💰 ${player.chips}`;
        playerDiv.appendChild(chipsDiv);

        // Прибыль/убыток
        if (player.totalBuyIn !== undefined) {
            const profit = player.profit !== undefined ? player.profit : (player.chips - player.totalBuyIn);
            const profitDiv = document.createElement('div');
            profitDiv.className = 'player-profit';
            profitDiv.textContent = profit >= 0 ? `+${profit}` : `${profit}`;
            profitDiv.style.color = profit >= 0 ? '#4caf50' : '#f44336';
            playerDiv.appendChild(profitDiv);
        }

        // Текущая ставка
        if (player.bet > 0) {
            const betDiv = document.createElement('div');
            betDiv.className = 'player-bet';
            betDiv.innerHTML = `🎯 Ставка: <strong>${player.bet}</strong>`;
            playerDiv.appendChild(betDiv);
        }
        
        // Индикатор хода
        if (index === gameState.currentPlayerIndex && gameState.state !== 'waiting' && gameState.state !== 'showdown') {
            const actionIndicator = document.createElement('div');
            actionIndicator.className = 'action-indicator';
            actionIndicator.textContent = isCurrentPlayer ? '👆 ВАШ ХОД' : '⏳ Думает...';
            playerDiv.appendChild(actionIndicator);
        }

        // All-in индикатор
        if (player.allIn) {
            const allInDiv = document.createElement('div');
            allInDiv.className = 'all-in-indicator';
            allInDiv.textContent = '🔥 ALL IN';
            playerDiv.appendChild(allInDiv);
        }

        // Карты игрока
        const cardsDiv = document.createElement('div');
        cardsDiv.className = 'player-cards';
        
        if (player.cards && player.cards.length > 0) {
            player.cards.forEach(card => {
                if (isCurrentPlayer || gameState.state === 'showdown') {
                    cardsDiv.appendChild(createCardElement(card, false));
                } else {
                    cardsDiv.appendChild(createCardBackElement());
                }
            });
        } else if (gameState.state !== 'waiting') {
            // Показываем рубашки если игра идет
            for (let i = 0; i < 2; i++) {
                cardsDiv.appendChild(createCardBackElement());
            }
        }
        playerDiv.appendChild(cardsDiv);

        playersContainer.appendChild(playerDiv);
    });

    // Мои карты (внизу экрана)
    const myPlayer = gameState.players ? gameState.players.find(p => p.id === playerId) : null;
    if (myPlayer) {
        if (playerHand) {
            playerHand.innerHTML = '';
            if (myPlayer.cards && Array.isArray(myPlayer.cards) && myPlayer.cards.length > 0) {
                myPlayer.cards.forEach(card => {
                    if (card) {
                        playerHand.appendChild(createCardElement(card, true));
                    }
                });
            }
        }
        if (playerChips) playerChips.textContent = myPlayer.chips || 0;
        if (playerBet) playerBet.textContent = myPlayer.bet || 0;
        
        // Обновляем компактные элементы
        if (playerChipsCompact) playerChipsCompact.textContent = myPlayer.chips || 0;
        if (playerBetCompact) playerBetCompact.textContent = myPlayer.bet || 0;
        
        // Статистика
        if (myPlayer.totalBuyIn !== undefined) {
            if (playerBuyIn) playerBuyIn.textContent = myPlayer.totalBuyIn;
            const profit = myPlayer.profit !== undefined ? myPlayer.profit : (myPlayer.chips - myPlayer.totalBuyIn);
            if (playerProfit) {
                playerProfit.textContent = profit >= 0 ? `+${profit}` : `${profit}`;
                playerProfit.style.color = profit >= 0 ? '#4caf50' : '#f44336';
            }
            if (playerProfitCompact) {
                playerProfitCompact.textContent = profit >= 0 ? `+${profit}` : `${profit}`;
                playerProfitCompact.style.color = profit >= 0 ? '#4caf50' : '#f44336';
            }
        }

        // Проверка моего хода
        isMyTurn = gameState.currentPlayerIndex === gameState.players.findIndex(p => p.id === playerId) &&
                   gameState.state !== 'waiting' && gameState.state !== 'showdown' &&
                   !myPlayer.folded && !myPlayer.allIn;

        if (foldBtn) foldBtn.disabled = !isMyTurn;
        if (callBtn) {
            callBtn.disabled = !isMyTurn;
            if (isMyTurn) {
                const callAmount = gameState.currentBet - myPlayer.bet;
                callBtn.textContent = callAmount > 0 ? `Колл (${callAmount})` : 'Чек ✓';
            } else {
                callBtn.textContent = 'Колл';
            }
        }
        if (raiseBtn) raiseBtn.disabled = !isMyTurn;
        if (allInBtn) {
            allInBtn.disabled = !isMyTurn;
            if (isMyTurn && myPlayer.chips > 0) {
                allInBtn.textContent = `🔥 ALL-IN (${myPlayer.chips + myPlayer.bet})`;
            }
        }

        if (isMyTurn) {
            timeLeft = gameState.timeLeft !== undefined ? gameState.timeLeft : 15;
            startTimer();
        } else {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }
    }
    
    // Проверяем состояние игры (в начале, чтобы использовать везде)
    const playersCount = gameState.players ? gameState.players.length : 0;
    const playersWithChips = gameState.players ? gameState.players.filter(p => p.chips > 0).length : 0;
    const isWaiting = gameState.state === 'waiting';
    const isShowdown = gameState.state === 'showdown';
    const isPlaying = ['betting', 'flop', 'turn', 'river'].includes(gameState.state);
    const hadPreviousHand = gameState.handHistory && gameState.handHistory.length > 0;
    
    // Управление докупкой фишек
    const isAdmin = gameState.adminId === playerId;
    if (adminControls) {
        if (isAdmin) {
            adminControls.style.display = 'block';
            if (allowBuyInCheck) allowBuyInCheck.checked = gameState.allowedBuyIn;
        } else {
            adminControls.style.display = 'none';
        }
    }
    
    // Докупка фишек (между раздачами если разрешено)
    if (buyInControls && buyInAmountInput) {
        const showBuyIn = gameState.allowedBuyIn && isWaiting;
        buyInControls.style.display = showBuyIn ? 'flex' : 'none';
        if (showBuyIn && !buyInAmountInput.value) {
            buyInAmountInput.value = gameState.buyInAmount || 1000;
        }
    }
    
    // Кнопка начала игры / следующей раздачи
    if (startGameBtn) {
        // Показываем когда: состояние waiting или showdown И есть 2+ игрока
        const isShowdown = gameState.state === 'showdown';
        const canStart = (isWaiting || isShowdown) && playersCount >= 2;
        
        if (canStart) {
            startGameBtn.style.display = 'inline-block';
            startGameBtn.textContent = (hadPreviousHand || isShowdown) ? '🃏 Следующая раздача' : '🎮 Начать игру';
            startGameBtn.onclick = () => {
                if (hadPreviousHand || isShowdown) {
                    socket.emit('nextHand', currentRoomId);
                } else {
                    socket.emit('startGame', currentRoomId);
                }
            };
        } else {
            startGameBtn.style.display = 'none';
        }
    }
    
    // Скрываем отдельную кнопку следующей раздачи
    if (nextHandBtn) {
        nextHandBtn.style.display = 'none';
    }
    
    // Кнопка добавления бота
    const hasBot = gameState.players && gameState.players.some(p => p.isBot);
    const canAddBot = !hasBot && gameState.players && gameState.players.length < 6 && isWaiting;
    if (addBotBtn) {
        addBotBtn.style.display = canAddBot ? 'block' : 'none';
        addBotBtn.textContent = '🤖 Добавить бота';
    }
    
    // Обновляем статус игры и таблицу лидеров
    updateGameStatus();
    updateLeaderboard();
}

// Обновление таблицы лидеров
function updateLeaderboard() {
    const leaderboardList = document.getElementById('leaderboardList');
    if (!leaderboardList || !gameState || !gameState.players) return;
    
    // Сортируем игроков по фишкам (убывание)
    const sortedPlayers = [...gameState.players].sort((a, b) => b.chips - a.chips);
    
    leaderboardList.innerHTML = sortedPlayers.map((player, index) => {
        const profit = player.profit !== undefined ? player.profit : (player.chips - (player.totalBuyIn || 1000));
        const profitClass = profit >= 0 ? 'positive' : 'negative';
        const profitText = profit >= 0 ? `+${profit}` : profit;
        
        let rankClass = '';
        let rankIcon = `${index + 1}.`;
        if (index === 0) { rankClass = 'first'; rankIcon = '🥇'; }
        else if (index === 1) { rankClass = 'second'; rankIcon = '🥈'; }
        else if (index === 2) { rankClass = 'third'; rankIcon = '🥉'; }
        
        const isMe = player.id === playerId;
        const nameDisplay = `${player.name}${isMe ? ' (Вы)' : ''}${player.isBot ? ' 🤖' : ''}`;
        
        return `
            <div class="leaderboard-item ${rankClass}">
                <span class="leaderboard-rank">${rankIcon}</span>
                <span class="leaderboard-name">${nameDisplay}</span>
                <span class="leaderboard-chips">💰 ${player.chips}</span>
                <span class="leaderboard-profit ${profitClass}">${profitText}</span>
            </div>
        `;
    }).join('');
}

// Статус игры
function updateGameStatus() {
    const statusDiv = document.getElementById('gameStatus');
    if (!statusDiv || !gameState) return;
    
    const stateText = {
        'waiting': '⏳ Ожидание игроков',
        'betting': '🃏 Префлоп - торги',
        'flop': '🎴 Флоп',
        'turn': '🎴 Тёрн',
        'river': '🎴 Ривер',
        'showdown': '🏆 Вскрытие карт'
    }[gameState.state] || gameState.state;
    
    statusDiv.textContent = stateText;
}

// Создание элемента карты
function createCardElement(card, animated = true) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
    
    if (animated) {
        cardDiv.style.animation = 'cardDeal 0.5s ease-out';
    }

    const rankTop = document.createElement('div');
    rankTop.className = 'card-rank';
    rankTop.textContent = card.rank;
    cardDiv.appendChild(rankTop);

    const suit = document.createElement('div');
    suit.className = 'card-suit';
    suit.textContent = card.suit;
    cardDiv.appendChild(suit);

    const rankBottom = document.createElement('div');
    rankBottom.className = 'card-rank-bottom';
    rankBottom.textContent = card.rank;
    cardDiv.appendChild(rankBottom);

    return cardDiv;
}

// Создание рубашки карты
function createCardBackElement() {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card card-back';
    
    const pattern = document.createElement('div');
    pattern.className = 'card-back-pattern';
    pattern.textContent = '🎴';
    cardDiv.appendChild(pattern);
    
    return cardDiv;
}

// Отображение результатов игры
function showGameResults(results) {
    if (!results) return;
    
    const modal = document.getElementById('resultsModal');
    const content = document.getElementById('resultsContent');
    if (!modal || !content) return;
    
    content.innerHTML = '';
    
    // Получаем победителей
    const winners = results.winners || [];
    
    if (winners.length > 0) {
        const winnerSection = document.createElement('div');
        winnerSection.className = 'winner-section';
        
        if (winners.length === 1) {
            // Один победитель
            const winner = winners[0];
            const handName = winner.handName || winner.oddsName || 'Победа';
            const chipsWon = winner.chipsWon || winner.winAmount || 0;
            
            winnerSection.innerHTML = `
                <h3>🏆 Победитель: ${winner.name} ${winner.isBot ? '🤖' : ''}</h3>
                <div class="winner-hand">
                    <div class="hand-name">${handName}</div>
                    <div class="hand-cards" id="winnerCards"></div>
                    <div class="chips-won">💰 Выигрыш: ${chipsWon} фишек</div>
                </div>
            `;
            content.appendChild(winnerSection);
            
            const winnerCardsDiv = document.getElementById('winnerCards');
            if (winnerCardsDiv && winner.hand) {
                winner.hand.forEach(card => {
                    winnerCardsDiv.appendChild(createCardElement(card, false));
                });
            }
        } else {
            // Несколько победителей (ничья)
            winnerSection.innerHTML = `<h3>🤝 Ничья! Победители:</h3>`;
            content.appendChild(winnerSection);
            
            winners.forEach((winner, idx) => {
                const winnerDiv = document.createElement('div');
                winnerDiv.className = 'winner-item';
                winnerDiv.innerHTML = `
                    <div class="winner-name">🏆 ${winner.name}</div>
                    <div class="hand-name">${winner.handName}</div>
                    <div class="hand-cards" id="winnerCards${idx}"></div>
                    <div class="chips-won">💰 ${winner.chipsWon} фишек</div>
                `;
                winnerSection.appendChild(winnerDiv);
                
                const cardsDiv = document.getElementById(`winnerCards${idx}`);
                if (cardsDiv && winner.hand) {
                    winner.hand.forEach(card => {
                        cardsDiv.appendChild(createCardElement(card, false));
                    });
                }
            });
        }
        
        // Side pots
        if (results.sidePots && results.sidePots.length > 1) {
            const sidePotsSection = document.createElement('div');
            sidePotsSection.className = 'side-pots-section';
            sidePotsSection.innerHTML = '<h4>📊 Side Pots:</h4>';
            
            results.sidePots.forEach((pot, index) => {
                const potDiv = document.createElement('div');
                potDiv.className = 'side-pot-item';
                potDiv.textContent = `Pot ${index + 1}: ${pot.size} фишек`;
                sidePotsSection.appendChild(potDiv);
            });
            
            content.appendChild(sidePotsSection);
        }
    }
    
    // Все комбинации
    if (results.allHands && results.allHands.length > 0) {
        const allHandsSection = document.createElement('div');
        allHandsSection.className = 'all-hands-section';
        allHandsSection.innerHTML = '<h4>📋 Все комбинации:</h4>';
        
        results.allHands.forEach((handInfo, idx) => {
            const isWinner = winners.some(w => w.id === handInfo.playerId);
            const handResult = document.createElement('div');
            handResult.className = `hand-result ${isWinner ? 'winner-hand' : ''}`;
            handResult.innerHTML = `
                <div class="hand-player">
                    <strong>${handInfo.playerName}</strong>
                    ${isWinner ? ' 🏆' : ''}
                </div>
                <div class="hand-info">
                    <span class="hand-type">${handInfo.handName}</span>
                    <div class="hand-cards-small" id="handCards${idx}"></div>
                </div>
            `;
            allHandsSection.appendChild(handResult);
            
            const cardsSmallDiv = document.getElementById(`handCards${idx}`);
            if (cardsSmallDiv && handInfo.hand) {
                handInfo.hand.forEach(card => {
                    const cardEl = createCardElement(card, false);
                    cardEl.style.width = '45px';
                    cardEl.style.height = '63px';
                    cardEl.style.fontSize = '0.65em';
                    cardsSmallDiv.appendChild(cardEl);
                });
            }
        });
        
        content.appendChild(allHandsSection);
    }
    
    modal.style.display = 'flex';
    
    // Закрытие и следующая раздача
    const closeBtn = document.getElementById('closeResultsBtn');
    if (closeBtn) {
        closeBtn.textContent = '🃏 Следующая раздача';
        closeBtn.onclick = () => { 
            modal.style.display = 'none';
            // Автоматически запускаем следующую раздачу
            if (currentRoomId) {
                socket.emit('nextHand', currentRoomId);
            }
        };
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // НЕ закрываем автоматически - пусть игрок сам нажмёт
}
