const socket = io();
let gameState = null;
let playerName = 'Игрок';

// Элементы DOM
const balanceEl = document.getElementById('balance');
const dealerCardsEl = document.getElementById('dealerCards');
const playerCardsEl = document.getElementById('playerCards');
const dealerScoreEl = document.getElementById('dealerScore');
const playerScoreEl = document.getElementById('playerScore');
const playerNameEl = document.getElementById('playerName');
const betSection = document.getElementById('betSection');
const actionsSection = document.getElementById('actionsSection');
const resultSection = document.getElementById('resultSection');
const currentBetDisplay = document.getElementById('currentBetDisplay');
const currentBetEl = document.getElementById('currentBet');
const resultMessageEl = document.getElementById('resultMessage');
const winningsDisplayEl = document.getElementById('winningsDisplay');

// Кнопки
const hitBtn = document.getElementById('hitBtn');
const standBtn = document.getElementById('standBtn');
const doubleBtn = document.getElementById('doubleBtn');
const newGameBtn = document.getElementById('newGameBtn');
const customBetBtn = document.getElementById('customBetBtn');
const customBetAmount = document.getElementById('customBetAmount');

// Запрос имени при загрузке
window.addEventListener('load', () => {
    const name = prompt('Введите ваше имя:');
    if (name && name.trim()) {
        playerName = name.trim();
        playerNameEl.textContent = playerName;
        socket.emit('blackjack-join', { playerName });
    } else {
        playerNameEl.textContent = 'Игрок';
        socket.emit('blackjack-join', { playerName: 'Игрок' });
    }
});

// Обработчики событий Socket.IO
socket.on('blackjack-state', (state) => {
    gameState = state;
    updateDisplay();
});

socket.on('blackjack-error', (message) => {
    alert(message);
});

// Обновление отображения
function updateDisplay() {
    if (!gameState) return;
    
    // Баланс
    balanceEl.textContent = gameState.balance;
    
    // Карты дилера
    dealerCardsEl.innerHTML = '';
    if (gameState.dealerCards) {
        gameState.dealerCards.forEach((card, index) => {
            if (card === null) {
                // Скрытая карта
                const cardEl = document.createElement('div');
                cardEl.className = 'card card-back';
                cardEl.innerHTML = '<div class="card-back-pattern">🂠</div>';
                dealerCardsEl.appendChild(cardEl);
            } else {
                const cardEl = createCardElement(card);
                dealerCardsEl.appendChild(cardEl);
            }
        });
    }
    
    // Карты игрока
    playerCardsEl.innerHTML = '';
    if (gameState.playerCards) {
        gameState.playerCards.forEach(card => {
            const cardEl = createCardElement(card);
            playerCardsEl.appendChild(cardEl);
        });
    }
    
    // Очки
    playerScoreEl.textContent = gameState.playerScore || 0;
    dealerScoreEl.textContent = gameState.dealerHidden ? '?' : (gameState.dealerScore || 0);
    
    // Отображение секций в зависимости от состояния
    if (gameState.state === 'betting') {
        betSection.style.display = 'block';
        actionsSection.style.display = 'none';
        resultSection.style.display = 'none';
        currentBetDisplay.style.display = 'none';
    } else if (gameState.state === 'playing') {
        betSection.style.display = 'none';
        actionsSection.style.display = 'flex';
        resultSection.style.display = 'none';
        currentBetDisplay.style.display = 'block';
        currentBetEl.textContent = gameState.bet;
        
        // Удвоить доступно только при 2 картах
        doubleBtn.disabled = gameState.playerCards.length !== 2 || gameState.balance < gameState.bet;
    } else if (gameState.state === 'dealerTurn') {
        betSection.style.display = 'none';
        actionsSection.style.display = 'none';
        resultSection.style.display = 'none';
        currentBetDisplay.style.display = 'block';
    } else if (gameState.state === 'finished') {
        betSection.style.display = 'none';
        actionsSection.style.display = 'none';
        resultSection.style.display = 'block';
        currentBetDisplay.style.display = 'block';
        
        // Результат
        let message = '';
        let winningsText = '';
        
        if (gameState.result === 'blackjack') {
            message = '🎉 Black Jack!';
            winningsText = `Выигрыш: ${gameState.winnings} (3:2)`;
        } else if (gameState.result === 'win') {
            message = '✅ Вы выиграли!';
            winningsText = `Выигрыш: ${gameState.winnings}`;
        } else if (gameState.result === 'lose') {
            message = '❌ Вы проиграли';
            winningsText = `Потеряно: ${gameState.bet}`;
        } else if (gameState.result === 'push') {
            message = '🤝 Ничья';
            winningsText = `Возврат: ${gameState.winnings}`;
        }
        
        resultMessageEl.textContent = message;
        winningsDisplayEl.textContent = winningsText;
    }
}

// Создание элемента карты
function createCardElement(card) {
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

// Кнопки ставок
document.querySelectorAll('.bet-btn[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        socket.emit('blackjack-bet', { amount });
    });
});

// Своя ставка
if (customBetBtn) {
    customBetBtn.addEventListener('click', () => {
        const amount = parseInt(customBetAmount.value);
        if (amount > 0) {
            socket.emit('blackjack-bet', { amount });
            customBetAmount.value = '';
        }
    });
}

// Действия
if (hitBtn) {
    hitBtn.addEventListener('click', () => {
        socket.emit('blackjack-hit');
    });
}

if (standBtn) {
    standBtn.addEventListener('click', () => {
        socket.emit('blackjack-stand');
    });
}

if (doubleBtn) {
    doubleBtn.addEventListener('click', () => {
        socket.emit('blackjack-double');
    });
}

if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
        socket.emit('blackjack-new-game');
    });
}

