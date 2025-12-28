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

// Запрос имени при загрузке
window.addEventListener('load', () => {
    const name = prompt('Введите ваше имя:');
    if (name && name.trim()) {
        playerName = name.trim();
        socket.emit('coinflip-join', { playerName });
    } else {
        socket.emit('coinflip-join', { playerName: 'Игрок' });
    }
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
    
    balanceEl.textContent = gameState.balance;
    
    if (gameState.state === 'betting') {
        betSection.style.display = 'block';
        choiceSection.style.display = 'none';
        resultSection.style.display = 'none';
        coinEl.classList.remove('flipping', 'heads-result', 'tails-result');
        coinResultEl.textContent = '';
    } else if (gameState.state === 'flipping') {
        betSection.style.display = 'none';
        choiceSection.style.display = 'none';
        resultSection.style.display = 'none';
        coinEl.classList.add('flipping');
    } else if (gameState.state === 'finished') {
        betSection.style.display = 'none';
        choiceSection.style.display = 'none';
        resultSection.style.display = 'block';
        
        // Показываем результат
        const result = gameState.result;
        coinEl.classList.remove('flipping');
        coinEl.classList.add(result === 'heads' ? 'heads-result' : 'tails-result');
        
        let message = '';
        let winningsText = '';
        
        if (gameState.won) {
            message = '🎉 Вы выиграли!';
            winningsText = `Выигрыш: ${gameState.winnings}`;
        } else {
            message = '❌ Вы проиграли';
            winningsText = `Потеряно: ${gameState.bet}`;
        }
        
        coinResultEl.textContent = result === 'heads' ? '🪙 Орел' : '🪙 Решка';
        resultMessageEl.textContent = message;
        winningsDisplayEl.textContent = winningsText;
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

