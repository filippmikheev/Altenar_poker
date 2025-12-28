const socket = io();
let gameState = null;
let playerName = 'Игрок';
let currentBetAmount = 0;

// Элементы DOM
const balanceEl = document.getElementById('balance');
const coinEl = document.getElementById('coin');
const coinResultEl = document.getElementById('coinResult');
const betSection = document.getElementById('betSection');
const choiceSection = document.getElementById('choiceSection');
const resultSection = document.getElementById('resultSection');
const currentBetDisplay = document.getElementById('currentBetDisplay');
const currentBetEl = document.getElementById('currentBet');
const resultMessageEl = document.getElementById('resultMessage');
const winningsDisplayEl = document.getElementById('winningsDisplay');
const headsBtn = document.getElementById('headsBtn');
const tailsBtn = document.getElementById('tailsBtn');
const newGameBtn = document.getElementById('newGameBtn');
const customBetBtn = document.getElementById('customBetBtn');
const customBetAmount = document.getElementById('customBetAmount');

// Получение баланса фишек
socket.on('chips-balance', (data) => {
    if (balanceEl) {
        balanceEl.textContent = data.balance || 0;
    }
});

// Получение имени и баланса при загрузке
window.addEventListener('load', () => {
    // Получаем баланс фишек (имя уже установлено в главном меню)
    socket.emit('chips-get-balance');
    
    socket.on('chips-balance', (data) => {
        if (data.playerName) {
            playerName = data.playerName;
        }
    });
    
    // Присоединяемся к игре
    socket.emit('coinflip-join', {});
});

// Обработчики событий Socket.IO
socket.on('coinflip-state', (state) => {
    gameState = state;
    updateDisplay();
});

socket.on('coinflip-error', (message) => {
    showError(message);
});

// Обновление отображения
function updateDisplay() {
    if (!gameState) return;
    
    if (balanceEl) {
        balanceEl.textContent = gameState.balance;
    }
    
    if (gameState.state === 'betting') {
        if (betSection) betSection.style.display = 'block';
        if (choiceSection) choiceSection.style.display = 'none';
        if (resultSection) resultSection.style.display = 'none';
        if (coinEl) {
            coinEl.classList.remove('flipping', 'heads-result', 'tails-result');
        }
        if (coinResultEl) coinResultEl.textContent = '';
    } else if (gameState.state === 'flipping') {
        if (betSection) betSection.style.display = 'none';
        if (choiceSection) choiceSection.style.display = 'none';
        if (resultSection) resultSection.style.display = 'none';
        if (coinEl) {
            coinEl.classList.remove('heads-result', 'tails-result');
            coinEl.classList.add('flipping');
        }
    } else if (gameState.state === 'finished') {
        if (betSection) betSection.style.display = 'none';
        if (choiceSection) choiceSection.style.display = 'none';
        if (resultSection) resultSection.style.display = 'block';
        
        // Показываем результат
        const result = gameState.result;
        if (coinEl) {
            coinEl.classList.remove('flipping');
            coinEl.classList.add(result === 'heads' ? 'heads-result' : 'tails-result');
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
        
        if (coinResultEl) {
            coinResultEl.textContent = result === 'heads' ? '🪙 Орел' : '🪙 Решка';
        }
        if (resultMessageEl) resultMessageEl.textContent = message;
        if (winningsDisplayEl) winningsDisplayEl.textContent = winningsText;
    }
}

// Кнопки ставок
document.querySelectorAll('.bet-btn[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        currentBetAmount = amount;
        betSection.style.display = 'none';
        choiceSection.style.display = 'block';
        currentBetEl.textContent = amount;
    });
});

// Своя ставка
if (customBetBtn) {
    customBetBtn.addEventListener('click', () => {
        const amount = parseInt(customBetAmount.value);
        if (amount > 0) {
            currentBetAmount = amount;
            betSection.style.display = 'none';
            choiceSection.style.display = 'block';
            currentBetEl.textContent = amount;
            customBetAmount.value = '';
        }
    });
}

// Выбор стороны
if (headsBtn) {
    headsBtn.addEventListener('click', () => {
        socket.emit('coinflip-bet', { amount: currentBetAmount, choice: 'heads' });
    });
}

if (tailsBtn) {
    tailsBtn.addEventListener('click', () => {
        socket.emit('coinflip-bet', { amount: currentBetAmount, choice: 'tails' });
    });
}

if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
        socket.emit('coinflip-new-game');
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

