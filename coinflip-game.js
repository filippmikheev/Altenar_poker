// Логика игры Монетка
class CoinFlipGame {
  constructor(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.balance = 1000; // Стартовый баланс
    this.bet = 0;
    this.choice = null; // 'heads' или 'tails'
    this.result = null; // 'heads' или 'tails'
    this.state = 'betting'; // betting, flipping, finished
    this.winnings = 0;
  }

  // Размещение ставки и выбор
  placeBet(amount, choice) {
    if (this.state !== 'betting') return false;
    if (amount <= 0 || amount > this.balance) return false;
    if (choice !== 'heads' && choice !== 'tails') return false;
    
    this.bet = amount;
    this.choice = choice;
    this.balance -= amount;
    this.state = 'flipping';
    
    return true;
  }

  // Подбрасывание монетки (вызывается отдельно)
  flipCoin() {
    if (this.state !== 'flipping') return false;
    
    // Случайный результат: 0 = орел (heads), 1 = решка (tails)
    const random = Math.random();
    this.result = random < 0.5 ? 'heads' : 'tails';
    
    this.state = 'finished';
    
    // Определяем выигрыш
    if (this.choice === this.result) {
      // Выигрыш
      this.winnings = this.bet * 2;
      this.balance += this.winnings;
    } else {
      // Проигрыш
      this.winnings = 0;
    }
    
    return true;
  }

  // Новая игра
  newGame() {
    this.bet = 0;
    this.choice = null;
    this.result = null;
    this.state = 'betting';
    this.winnings = 0;
  }

  // Получить состояние игры
  getGameState() {
    return {
      balance: this.balance,
      bet: this.bet,
      choice: this.choice,
      result: this.result,
      state: this.state,
      winnings: this.winnings,
      won: this.result && this.choice === this.result
    };
  }
}

module.exports = CoinFlipGame;

