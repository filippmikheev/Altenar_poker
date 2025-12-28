const socket = io();
let gameState = null;
let playerName = 'Игрок';
let currentBetAmount = 0;

// Элементы DOM
const balanceEl = document.getElementById('balance');
const playerChoiceEl = document.getElementById('playerChoice');
const botChoiceEl = document.getElementById('botChoice');
const betSection = document.getElementById('betSection');
const choiceSection = document.getElementById('choiceSection');
const resultSection = document.getElementById('resultSection');
const currentBetDisplay = document.getElementById('currentBetDisplay');
const currentBetEl = document.getElementById('currentBet');
const resultMessageEl = document.getElementById('resultMessage');
const winningsDisplayEl = document.getElementById('winningsDisplay');
const rockBtn = document.getElementById('rockBtn');
const paperBtn = document.getElementById('paperBtn');
const scissorsBtn = document.getElementById('scissorsBtn');
const newGameBtn = document.getElementById('newGameBtn');
const customBetBtn = document.getElementById('customBetBtn');
const customBetAmount = document.getElementById('customBetAmount');

const choiceEmojis = {
    'rock': '🪨',
    'paper': '📄',
    'scissors': '✂️'
};

// Запрос имени при загрузке
window.addEventListener('load', () => {
    const name = prompt('Введите ваше имя:');
    if (name && name.trim()) {
        playerName = name.trim();
        socket.emit('rps-join', { playerName });
    } else {
        socket.emit('rps-join', { playerName: 'Игрок' });
    }
});

// Обработчики событий Socket.IO
socket.on('rps-state', (state) => {
    gameState = state;
    updateDisplay();
});

socket.on('rps-error', (message) => {
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
        playerChoiceEl.textContent = '❓';
        botChoiceEl.textContent = '❓';
    } else if (gameState.state === 'playing') {
        betSection.style.display = 'none';
        choiceSection.style.display = 'block';
        resultSection.style.display = 'none';
        currentBetEl.textContent = gameState.bet;
        playerChoiceEl.textContent = '❓';
        botChoiceEl.textContent = '❓';
    } else if (gameState.state === 'finished') {
        betSection.style.display = 'none';
        choiceSection.style.display = 'none';
        resultSection.style.display = 'block';
        
        // Показываем выборы
        playerChoiceEl.textContent = choiceEmojis[gameState.playerChoice] || '❓';
        botChoiceEl.textContent = choiceEmojis[gameState.botChoice] || '❓';
        
        let message = '';
        let winningsText = '';
        
        if (gameState.result === 'win') {
            message = '🎉 Вы выиграли!';
            winningsText = `Выигрыш: ${gameState.winnings}`;
        } else if (gameState.result === 'lose') {
            message = '❌ Вы проиграли';
            winningsText = `Потеряно: ${gameState.bet}`;
        } else if (gameState.result === 'draw') {
            message = '🤝 Ничья';
            winningsText = `Возврат: ${gameState.winnings}`;
        }
        
        resultMessageEl.textContent = message;
        winningsDisplayEl.textContent = winningsText;
    }
}

// Кнопки ставок
document.querySelectorAll('.bet-btn[data-amount]').forEach(btn => {
    btn.addEventListener('click', () => {
        const amount = parseInt(btn.dataset.amount);
        currentBetAmount = amount;
        socket.emit('rps-bet', { amount });
    });
});

// Своя ставка
if (customBetBtn) {
    customBetBtn.addEventListener('click', () => {
        const amount = parseInt(customBetAmount.value);
        if (amount > 0) {
            currentBetAmount = amount;
            socket.emit('rps-bet', { amount });
            customBetAmount.value = '';
        }
    });
}

// Выбор хода
if (rockBtn) {
    rockBtn.addEventListener('click', () => {
        socket.emit('rps-choice', { choice: 'rock' });
    });
}

if (paperBtn) {
    paperBtn.addEventListener('click', () => {
        socket.emit('rps-choice', { choice: 'paper' });
    });
}

if (scissorsBtn) {
    scissorsBtn.addEventListener('click', () => {
        socket.emit('rps-choice', { choice: 'scissors' });
    });
}

if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
        socket.emit('rps-new-game');
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

