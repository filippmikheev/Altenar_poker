// Логика игры Слот-машина
class SlotsGame {
  constructor(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.balance = 1000; // Стартовый баланс
    this.bet = 0;
    this.reels = [null, null, null]; // Три барабана
    this.state = 'betting'; // betting, spinning, finished
    this.winnings = 0;
    this.symbols = ['🍒', '🍋', '🍊', '🍇', '🔔', '⭐', '💎', '7️⃣'];
    this.multipliers = {
      '🍒': 2,
      '🍋': 3,
      '🍊': 4,
      '🍇': 5,
      '🔔': 6,
      '⭐': 8,
      '💎': 10,
      '7️⃣': 20
    };
  }

  // Размещение ставки
  placeBet(amount) {
    if (this.state !== 'betting') return false;
    if (amount <= 0 || amount > this.balance) return false;
    
    this.bet = amount;
    this.balance -= amount;
    this.state = 'spinning';
    
    // Крутим барабаны
    setTimeout(() => {
      this.spin();
    }, 100);
    
    return true;
  }

  // Кручение барабанов
  spin() {
    // Генерируем случайные символы для каждого барабана
    this.reels = [
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)],
      this.symbols[Math.floor(Math.random() * this.symbols.length)]
    ];
    
    this.state = 'finished';
    
    // Определяем выигрыш
    this.calculateWin();
  }

  // Подсчет выигрыша
  calculateWin() {
    const [a, b, c] = this.reels;
    
    // Три одинаковых символа
    if (a === b && b === c) {
      const multiplier = this.multipliers[a] || 1;
      this.winnings = this.bet * multiplier;
      this.balance += this.winnings;
      return;
    }
    
    // Два одинаковых символа
    if (a === b || b === c || a === c) {
      const sameSymbol = a === b ? a : (b === c ? b : a);
      const multiplier = this.multipliers[sameSymbol] || 1;
      this.winnings = Math.floor(this.bet * multiplier * 0.5);
      this.balance += this.winnings;
      return;
    }
    
    // Нет выигрыша
    this.winnings = 0;
  }

  // Новая игра
  newGame() {
    this.bet = 0;
    this.reels = [null, null, null];
    this.state = 'betting';
    this.winnings = 0;
  }

  // Получить состояние игры
  getGameState() {
    return {
      balance: this.balance,
      bet: this.bet,
      reels: this.reels,
      state: this.state,
      winnings: this.winnings,
      won: this.winnings > 0
    };
  }
}

module.exports = SlotsGame;

