// Логика игры Black Jack
class BlackJackGame {
  constructor(playerId, playerName) {
    this.playerId = playerId;
    this.playerName = playerName;
    this.deck = [];
    this.playerCards = [];
    this.dealerCards = [];
    this.playerScore = 0;
    this.dealerScore = 0;
    this.state = 'betting'; // betting, playing, dealerTurn, finished
    this.bet = 0;
    this.balance = 1000; // Стартовый баланс
    this.winnings = 0;
    this.result = null; // win, lose, push, blackjack
    this.dealerHidden = true; // Первая карта дилера скрыта
  }

  // Создание колоды
  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    this.deck = [];
    
    for (let suit of suits) {
      for (let rank of ranks) {
        let value;
        if (rank === 'A') {
          value = 11; // Туз по умолчанию 11, потом может стать 1
        } else if (['J', 'Q', 'K'].includes(rank)) {
          value = 10;
        } else {
          value = parseInt(rank);
        }
        
        this.deck.push({
          suit,
          rank,
          value,
          display: `${rank}${suit}`
        });
      }
    }
    
    // Перемешивание колоды
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  // Раздача начальных карт
  dealInitialCards() {
    this.createDeck();
    this.playerCards = [];
    this.dealerCards = [];
    this.dealerHidden = true;
    
    // Игроку 2 карты
    this.playerCards.push(this.deck.pop());
    this.playerCards.push(this.deck.pop());
    
    // Дилеру 2 карты
    this.dealerCards.push(this.deck.pop());
    this.dealerCards.push(this.deck.pop());
    
    this.updateScores();
    
    // Проверка на Black Jack
    if (this.playerScore === 21 && this.dealerCards[1].rank === 'A') {
      // Если у игрока 21 и у дилера туз - проверяем вторую карту дилера
      const dealerSecondCard = this.dealerCards[1];
      if (dealerSecondCard.value === 10 || ['J', 'Q', 'K'].includes(dealerSecondCard.rank)) {
        // У дилера тоже Black Jack - ничья
        this.dealerHidden = false;
        this.state = 'finished';
        this.result = 'push';
        this.winnings = this.bet; // Возврат ставки
        return;
      }
    }
    
    if (this.playerScore === 21) {
      // У игрока Black Jack
      this.dealerHidden = false;
      this.state = 'finished';
      this.result = 'blackjack';
      this.winnings = Math.floor(this.bet * 2.5); // Black Jack платит 3:2
      this.balance += this.winnings;
      return;
    }
    
    this.state = 'playing';
  }

  // Подсчет очков с учетом тузов
  calculateScore(cards) {
    if (!cards || cards.length === 0) return 0;
    
    let score = 0;
    let aces = 0;
    
    for (let card of cards) {
      if (card && card.rank === 'A') {
        aces++;
        score += 11;
      } else if (card) {
        // Используем правильное значение карты
        if (['J', 'Q', 'K'].includes(card.rank)) {
          score += 10;
        } else if (card.rank === 'A') {
          aces++;
          score += 11;
        } else {
          score += card.value || parseInt(card.rank) || 0;
        }
      }
    }
    
    // Если перебор и есть тузы, уменьшаем их значение (11 -> 1)
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }
    
    return score;
  }

  // Обновление очков
  updateScores() {
    this.playerScore = this.calculateScore(this.playerCards);
    this.dealerScore = this.calculateScore(this.dealerCards);
  }

  // Взять карту (Hit)
  hit() {
    if (this.state !== 'playing') return false;
    
    this.playerCards.push(this.deck.pop());
    this.updateScores();
    
    if (this.playerScore > 21) {
      // Перебор - игрок проиграл
      this.dealerHidden = false;
      this.state = 'finished';
      this.result = 'lose';
      this.winnings = 0;
      return true;
    }
    
    return true;
  }

  // Остановиться (Stand)
  stand() {
    if (this.state !== 'playing') return false;
    
    this.dealerHidden = false;
    this.state = 'dealerTurn';
    
    // Дилер берет карты до 17
    while (this.dealerScore < 17) {
      this.dealerCards.push(this.deck.pop());
      this.updateScores();
    }
    
    // Определение результата
    this.determineWinner();
    return true;
  }

  // Удвоить ставку (Double Down)
  doubleDown() {
    if (this.state !== 'playing' || this.playerCards.length !== 2) return false;
    if (this.balance < this.bet) return false; // Недостаточно средств
    
    this.balance -= this.bet;
    this.bet *= 2;
    
    // Берем одну карту
    this.playerCards.push(this.deck.pop());
    this.updateScores();
    
    if (this.playerScore > 21) {
      // Перебор
      this.dealerHidden = false;
      this.state = 'finished';
      this.result = 'lose';
      this.winnings = 0;
      return true;
    }
    
    // Автоматически переходим к дилеру
    return this.stand();
  }

  // Определение победителя
  determineWinner() {
    this.state = 'finished';
    
    if (this.dealerScore > 21) {
      // Дилер перебрал
      this.result = 'win';
      this.winnings = this.bet * 2;
    } else if (this.playerScore > this.dealerScore) {
      // Игрок выиграл
      this.result = 'win';
      this.winnings = this.bet * 2;
    } else if (this.playerScore < this.dealerScore) {
      // Дилер выиграл
      this.result = 'lose';
      this.winnings = 0;
    } else {
      // Ничья
      this.result = 'push';
      this.winnings = this.bet; // Возврат ставки
    }
    
    this.balance += this.winnings;
  }

  // Размещение ставки
  placeBet(amount) {
    if (this.state !== 'betting') return false;
    if (amount <= 0 || amount > this.balance) return false;
    
    this.bet = amount;
    this.balance -= amount;
    this.dealInitialCards();
    return true;
  }

  // Новая игра
  newGame() {
    this.bet = 0;
    this.winnings = 0;
    this.result = null;
    this.state = 'betting';
    this.playerCards = [];
    this.dealerCards = [];
    this.playerScore = 0;
    this.dealerScore = 0;
    this.dealerHidden = true;
  }

  // Получить состояние игры
  getGameState() {
    return {
      playerCards: this.playerCards,
      dealerCards: this.dealerHidden ? [this.dealerCards[0], null] : this.dealerCards,
      playerScore: this.playerScore,
      dealerScore: this.dealerHidden ? null : this.dealerScore,
      state: this.state,
      bet: this.bet,
      balance: this.balance,
      winnings: this.winnings,
      result: this.result,
      dealerHidden: this.dealerHidden
    };
  }
}

module.exports = BlackJackGame;

