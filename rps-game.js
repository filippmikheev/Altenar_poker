// Логика игры Камень-ножницы-бумага
class RPSGame {
  constructor(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.balance = 1000; // Стартовый баланс
    this.bet = 0;
    this.playerChoice = null; // 'rock', 'paper', 'scissors'
    this.botChoice = null;
    this.state = 'betting'; // betting, playing, finished
    this.winnings = 0;
    this.result = null; // 'win', 'lose', 'draw'
  }

  // Размещение ставки
  placeBet(amount) {
    if (this.state !== 'betting') return false;
    if (amount <= 0 || amount > this.balance) return false;
    
    this.bet = amount;
    this.balance -= amount;
    this.state = 'playing';
    
    return true;
  }

  // Выбор игрока
  makeChoice(choice) {
    if (this.state !== 'playing') return false;
    if (!['rock', 'paper', 'scissors'].includes(choice)) return false;
    
    this.playerChoice = choice;
    
    // Бот делает случайный выбор
    const choices = ['rock', 'paper', 'scissors'];
    this.botChoice = choices[Math.floor(Math.random() * choices.length)];
    
    // Определяем результат
    this.determineWinner();
    
    return true;
  }

  // Определение победителя
  determineWinner() {
    this.state = 'finished';
    
    const { playerChoice, botChoice } = this;
    
    // Ничья
    if (playerChoice === botChoice) {
      this.result = 'draw';
      this.winnings = this.bet; // Возврат ставки
      this.balance += this.winnings;
      return;
    }
    
    // Правила выигрыша
    const winConditions = {
      'rock': 'scissors',      // Камень бьет ножницы
      'paper': 'rock',         // Бумага бьет камень
      'scissors': 'paper'      // Ножницы бьют бумагу
    };
    
    if (winConditions[playerChoice] === botChoice) {
      // Игрок выиграл
      this.result = 'win';
      this.winnings = this.bet * 2;
      this.balance += this.winnings;
    } else {
      // Игрок проиграл
      this.result = 'lose';
      this.winnings = 0;
    }
  }

  // Новая игра
  newGame() {
    this.bet = 0;
    this.playerChoice = null;
    this.botChoice = null;
    this.state = 'betting';
    this.winnings = 0;
    this.result = null;
  }

  // Получить состояние игры
  getGameState() {
    return {
      balance: this.balance,
      bet: this.bet,
      playerChoice: this.playerChoice,
      botChoice: this.botChoice,
      state: this.state,
      winnings: this.winnings,
      result: this.result,
      won: this.result === 'win'
    };
  }
}

module.exports = RPSGame;

