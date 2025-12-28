const socket = io();
let currentRoomId = null;
let playerId = null;
let gameState = null;
let playerName = 'Игрок';

// Элементы DOM
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const playerNameInput = document.getElementById('playerName');
const roomIdInput = document.getElementById('roomId');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
const roomsList = document.getElementById('roomsList');
const roomNameSpan = document.getElementById('roomName');
const dealerCardsEl = document.getElementById('dealerCards');
const dealerScoreEl = document.getElementById('dealerScore');
const playersSection = document.getElementById('playersSection');
const myTurnSection = document.getElementById('myTurnSection');
const betSection = document.getElementById('betSection');
const gameControls = document.getElementById('gameControls');
const hitBtn = document.getElementById('hitBtn');
const standBtn = document.getElementById('standBtn');
const doubleBtn = document.getElementById('doubleBtn');
const addBotBtn = document.getElementById('addBotBtn');
const startGameBtn = document.getElementById('startGameBtn');
const newGameBtn = document.getElementById('newGameBtn');
const customBetBtn = document.getElementById('customBetBtn');
const customBetAmount = document.getElementById('customBetAmount');

socket.on('connect', () => {
    playerId = socket.id;
    socket.emit('chips-get-balance');
    socket.emit('blackjack-multi-get-rooms');
});

// Получение баланса фишек
socket.on('chips-balance', (data) => {
    // Обновляем отображение баланса, если есть элемент
    const balanceEl = document.getElementById('chipsBalance');
    if (balanceEl) {
        balanceEl.textContent = data.balance || 0;
    }
});

socket.on('blackjack-multi-joined', (roomId) => {
    currentRoomId = roomId;
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    roomNameSpan.textContent = roomId;
    socket.emit('blackjack-multi-get-rooms');
});

socket.on('blackjack-multi-state', (state) => {
    gameState = state;
    updateDisplay();
});

socket.on('blackjack-multi-rooms', (rooms) => {
    updateRoomsList(rooms);
});

socket.on('blackjack-multi-error', (message) => {
    alert(message);
});

// Получение имени при подключении
socket.on('chips-balance', (data) => {
    if (data.playerName) {
        playerName = data.playerName;
        if (playerNameInput) {
            playerNameInput.value = playerName;
            playerNameInput.disabled = true;
        }
    }
});

socket.on('connect', () => {
    socket.emit('chips-get-balance');
});

// Создание комнаты
if (createBtn) {
    createBtn.addEventListener('click', () => {
        if (!playerName) {
            alert('Сначала введите ваше имя в главном меню');
            window.location.href = '/';
            return;
        }
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        socket.emit('blackjack-multi-create', roomId);
    });
}

// Присоединение к комнате
if (joinBtn) {
    joinBtn.addEventListener('click', () => {
        if (!playerName) {
            alert('Сначала введите ваше имя в главном меню');
            window.location.href = '/';
            return;
        }
        const roomId = roomIdInput.value.trim().toUpperCase();
        if (!roomId) {
            alert('Введите ID комнаты');
            return;
        }
        socket.emit('blackjack-multi-join', { roomId });
    });
}

if (refreshRoomsBtn) {
    refreshRoomsBtn.addEventListener('click', () => {
        socket.emit('blackjack-multi-get-rooms');
    });
}

// Обновление отображения
function updateDisplay() {
    if (!gameState) return;
    
    // Дилер
    dealerCardsEl.innerHTML = '';
    if (gameState.dealer && gameState.dealer.cards) {
        gameState.dealer.cards.forEach(card => {
            if (card === null) {
                const cardEl = document.createElement('div');
                cardEl.className = 'card card-back';
                cardEl.innerHTML = '<div class="card-back-pattern">🂠</div>';
                dealerCardsEl.appendChild(cardEl);
            } else {
                dealerCardsEl.appendChild(createCardElement(card));
            }
        });
    }
    dealerScoreEl.textContent = gameState.dealer && gameState.dealer.score !== null 
        ? gameState.dealer.score : '?';
    
    // Игроки
    playersSection.innerHTML = '';
    if (gameState.players) {
        gameState.players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.innerHTML = `
                <div class="player-name">${player.name}${player.isBot ? ' 🤖' : ''}</div>
                <div class="player-score">${player.score || 0}</div>
                <div class="player-cards-small">
                    ${player.cards ? player.cards.map(c => createCardElement(c).outerHTML).join('') : ''}
                </div>
                <div class="player-bet">Ставка: ${player.bet || 0}</div>
                <div class="player-balance">Баланс: ${player.balance || 0}</div>
            `;
            playersSection.appendChild(playerDiv);
        });
    }
    
    // Отображение секций
    if (gameState.state === 'waiting') {
        betSection.style.display = 'none';
        myTurnSection.style.display = 'none';
        gameControls.style.display = 'block';
    } else if (gameState.state === 'betting') {
        betSection.style.display = 'block';
        myTurnSection.style.display = 'none';
        gameControls.style.display = 'none';
    } else if (gameState.state === 'playing') {
        betSection.style.display = 'none';
        gameControls.style.display = 'none';
        
        const myPlayer = gameState.players.find(p => p.id === playerId);
        if (myPlayer && myPlayer.state === 'playing' && gameState.currentPlayerIndex === gameState.players.indexOf(myPlayer)) {
            myTurnSection.style.display = 'block';
        } else {
            myTurnSection.style.display = 'none';
        }
    } else {
        betSection.style.display = 'none';
        myTurnSection.style.display = 'none';
        gameControls.style.display = 'block';
    }
}

function createCardElement(card) {
    if (!card) return null;
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.classList.add(card.suit === '♥' || card.suit === '♦' ? 'red' : 'black');
    cardEl.innerHTML = `
        <div class="card-rank">${card.rank}</div>
        <div class="card-suit">${card.suit}</div>
        <div class="card-rank-bottom">${card.rank}</div>
    `;
    return cardEl;
}

function updateRoomsList(rooms) {
    if (!roomsList) return;
    if (!rooms || rooms.length === 0) {
        roomsList.innerHTML = '<div class="no-rooms">Нет активных столов</div>';
        return;
    }
    roomsList.innerHTML = rooms.map(room => `
        <div class="room-item">
            <div>ID: ${room.roomId}</div>
            <div>Игроков: ${room.players}</div>
            <button class="join-room-btn" onclick="joinRoom('${room.roomId}')">Присоединиться</button>
        </div>
    `).join('');
}

function joinRoom(roomId) {
    if (!playerName) {
        alert('Сначала введите ваше имя в главном меню');
        window.location.href = '/';
        return;
    }
    roomIdInput.value = roomId;
    socket.emit('blackjack-multi-join', { roomId });
}

// Действия
if (hitBtn) hitBtn.addEventListener('click', () => {
    if (currentRoomId) socket.emit('blackjack-multi-action', { roomId: currentRoomId, action: 'hit' });
});

if (standBtn) standBtn.addEventListener('click', () => {
    if (currentRoomId) socket.emit('blackjack-multi-action', { roomId: currentRoomId, action: 'stand' });
});

if (doubleBtn) doubleBtn.addEventListener('click', () => {
    if (currentRoomId) socket.emit('blackjack-multi-action', { roomId: currentRoomId, action: 'double' });
});

if (addBotBtn) addBotBtn.addEventListener('click', () => {
    if (currentRoomId) socket.emit('blackjack-multi-add-bot', currentRoomId);
});

if (startGameBtn) startGameBtn.addEventListener('click', () => {
    if (currentRoomId) socket.emit('blackjack-multi-start', currentRoomId);
});

if (newGameBtn) newGameBtn.addEventListener('click', () => {
    if (currentRoomId) socket.emit('blackjack-multi-new-game', currentRoomId);
});

// Ставки
document.querySelectorAll('.bet-btn[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        if (currentRoomId) socket.emit('blackjack-multi-bet', { roomId: currentRoomId, amount });
    });
});

if (customBetBtn) {
    customBetBtn.addEventListener('click', () => {
        const amount = parseInt(customBetAmount.value);
        if (amount > 0 && currentRoomId) {
            socket.emit('blackjack-multi-bet', { roomId: currentRoomId, amount });
            customBetAmount.value = '';
        }
    });
}

