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

// Получение баланса фишек
socket.on('chips-balance', (data) => {
    if (balanceEl) {
        balanceEl.textContent = data.balance || 0;
    }
});

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
    
    // Получаем баланс фишек
    socket.emit('chips-get-balance');
});

// Обработчики событий Socket.IO
socket.on('blackjack-state', (state) => {
    gameState = state;
    updateDisplay();
});

socket.on('blackjack-error', (message) => {
    // Показываем ошибку более красиво
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #e74c3c; color: white; padding: 15px 25px; border-radius: 10px; z-index: 10000; box-shadow: 0 5px 20px rgba(0,0,0,0.3);';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.style.transition = 'opacity 0.3s';
        errorDiv.style.opacity = '0';
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
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
                cardEl.style.opacity = '0';
                cardEl.style.transform = 'scale(0.8)';
                dealerCardsEl.appendChild(cardEl);
                setTimeout(() => {
                    cardEl.style.transition = 'all 0.3s ease';
                    cardEl.style.opacity = '1';
                    cardEl.style.transform = 'scale(1)';
                }, 10);
            } else {
                const cardEl = createCardElement(card);
                if (cardEl) dealerCardsEl.appendChild(cardEl);
            }
        });
    }
    
    // Карты игрока
    playerCardsEl.innerHTML = '';
    if (gameState.playerCards) {
        gameState.playerCards.forEach((card, index) => {
            const cardEl = createCardElement(card);
            if (cardEl) {
                // Задержка для анимации каждой карты
                cardEl.style.transitionDelay = `${index * 0.1}s`;
                playerCardsEl.appendChild(cardEl);
            }
        });
    }
    
    // Очки
    const playerScore = gameState.playerScore || 0;
    const dealerScore = gameState.dealerHidden ? null : (gameState.dealerScore || 0);
    
    playerScoreEl.textContent = playerScore;
    if (playerScore > 21) {
        playerScoreEl.textContent = `${playerScore} (Перебор!)`;
        playerScoreEl.style.color = '#e74c3c';
    } else if (playerScore === 21 && gameState.playerCards && gameState.playerCards.length === 2) {
        playerScoreEl.textContent = `${playerScore} (Black Jack!)`;
        playerScoreEl.style.color = '#f39c12';
    } else {
        playerScoreEl.style.color = 'var(--gold)';
    }
    
    if (dealerScore !== null) {
        dealerScoreEl.textContent = dealerScore;
        if (dealerScore > 21) {
            dealerScoreEl.textContent = `${dealerScore} (Перебор!)`;
            dealerScoreEl.style.color = '#e74c3c';
        } else {
            dealerScoreEl.style.color = 'var(--gold)';
        }
    } else {
        dealerScoreEl.textContent = '?';
        dealerScoreEl.style.color = 'var(--gold)';
    }
    
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

