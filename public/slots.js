const socket = io();
let gameState = null;
let playerName = 'Игрок';

// Элементы DOM
const balanceEl = document.getElementById('balance');
const reel1El = document.getElementById('reel1');
const reel2El = document.getElementById('reel2');
const reel3El = document.getElementById('reel3');
const slotsResultEl = document.getElementById('slotsResult');
const betSection = document.getElementById('betSection');
const resultSection = document.getElementById('resultSection');
const currentBetDisplay = document.getElementById('currentBetDisplay');
const currentBetEl = document.getElementById('currentBet');
const resultMessageEl = document.getElementById('resultMessage');
const winningsDisplayEl = document.getElementById('winningsDisplay');
const newGameBtn = document.getElementById('newGameBtn');
const customBetBtn = document.getElementById('customBetBtn');
const customBetAmount = document.getElementById('customBetAmount');

// Символы для анимации
const symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];

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
        socket.emit('slots-join', { playerName });
    } else {
        socket.emit('slots-join', { playerName: 'Игрок' });
    }
    
    // Получаем баланс фишек
    socket.emit('chips-get-balance');
});

// Обработчики событий Socket.IO
socket.on('slots-state', (state) => {
    gameState = state;
    updateDisplay();
});

socket.on('slots-error', (message) => {
    showError(message);
});

// Обновление отображения
function updateDisplay() {
    if (!gameState) return;
    
    balanceEl.textContent = gameState.balance;
    
    if (gameState.state === 'betting') {
        betSection.style.display = 'block';
        resultSection.style.display = 'none';
        currentBetDisplay.style.display = 'none';
        reel1El.textContent = '🎰';
        reel2El.textContent = '🎰';
        reel3El.textContent = '🎰';
        slotsResultEl.textContent = '';
    } else if (gameState.state === 'spinning') {
        betSection.style.display = 'none';
        resultSection.style.display = 'none';
        currentBetDisplay.style.display = 'block';
        currentBetEl.textContent = gameState.bet;
        
        // Анимация кручения
        spinAnimation();
    } else if (gameState.state === 'finished') {
        betSection.style.display = 'none';
        resultSection.style.display = 'block';
        currentBetDisplay.style.display = 'block';
        
        // Показываем результат
        if (gameState.reels) {
            reel1El.textContent = gameState.reels[0] || '🎰';
            reel2El.textContent = gameState.reels[1] || '🎰';
            reel3El.textContent = gameState.reels[2] || '🎰';
        }
        
        let message = '';
        let winningsText = '';
        
        if (gameState.won) {
            message = '🎉 Вы выиграли!';
            winningsText = `Выигрыш: ${gameState.winnings}`;
        } else {
            message = '❌ Вы проиграли';
            winningsText = `Потеряно: ${gameState.bet}`;
        }
        
        resultMessageEl.textContent = message;
        winningsDisplayEl.textContent = winningsText;
    }
}

// Анимация кручения
function spinAnimation() {
    let iterations = 0;
    const maxIterations = 20;
    
    const interval = setInterval(() => {
        reel1El.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        reel2El.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        reel3El.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        
        iterations++;
        if (iterations >= maxIterations) {
            clearInterval(interval);
        }
    }, 100);
}

// Кнопки ставок
document.querySelectorAll('.bet-btn[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        socket.emit('slots-bet', { amount });
    });
});

// Своя ставка
if (customBetBtn) {
    customBetBtn.addEventListener('click', () => {
        const amount = parseInt(customBetAmount.value);
        if (amount > 0) {
            socket.emit('slots-bet', { amount });
            customBetAmount.value = '';
        }
    });
}

if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
        socket.emit('slots-new-game');
    });
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #e74c3c; color: white; padding: 15px 25px; border-radius: 10px; z-index: 10000; box-shadow: 0 5px 20px rgba(0,0,0,0.3);';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.style.transition = 'opacity 0.3s';
        errorDiv.style.opacity = '0';
        setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
}

