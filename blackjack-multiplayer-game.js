// Логика игры Black Jack для нескольких игроков
class BlackJackMultiplayerGame {
  constructor(roomId, adminId) {
    this.roomId = roomId;
    this.adminId = adminId;
    this.players = [];
    this.dealer = {
      cards: [],
      score: 0,
      hidden: true
    };
    this.deck = [];
    this.state = 'waiting'; // waiting, betting, playing, dealerTurn, finished
    this.currentPlayerIndex = 0;
    this.betAmount = 0;
  }

  // Добавление игрока
  addPlayer(playerId, playerName) {
    if (this.players.length >= 6) return false;
    if (this.players.some(p => p.id === playerId)) return false;
    
    this.players.push({
      id: playerId,
      name: playerName,
      cards: [],
      score: 0,
      bet: 0,
      balance: 1000,
      state: 'waiting', // waiting, betting, playing, finished
      choice: null, // 'hit', 'stand', 'double'
      winnings: 0,
      result: null // 'win', 'lose', 'push', 'blackjack'
    });
    
    return true;
  }

  // Добавление бота
  addBot() {
    if (this.players.length >= 6) return false;
    if (this.players.some(p => p.isBot)) return false;
    
    this.players.push({
      id: 'bot_' + Date.now(),
      name: 'Бот',
      cards: [],
      score: 0,
      bet: 0,
      balance: 1000,
      state: 'waiting',
      choice: null,
      winnings: 0,
      result: null,
      isBot: true
    });
    
    return true;
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
          value = 11;
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
    
    // Перемешивание
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  // Начало игры
  startGame() {
    if (this.state !== 'waiting' || this.players.length < 1) return false;
    
    this.state = 'betting';
    this.currentPlayerIndex = 0;
    return true;
  }

  // Размещение ставки игроком
  placeBet(playerId, amount) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.state !== 'waiting' || amount <= 0 || amount > player.balance) {
      return false;
    }
    
    player.bet = amount;
    player.balance -= amount;
    player.state = 'betting';
    
    // Если все сделали ставки, начинаем раздачу
    if (this.players.every(p => p.bet > 0 || p.isBot)) {
      this.dealCards();
    }
    
    return true;
  }

  // Раздача карт
  dealCards() {
    this.createDeck();
    this.state = 'playing';
    this.currentPlayerIndex = 0;
    
    // Раздаем по 2 карты каждому игроку
    for (let player of this.players) {
      if (player.bet > 0) {
        player.cards = [];
        player.cards.push(this.deck.pop());
        player.cards.push(this.deck.pop());
        player.score = this.calculateScore(player.cards);
        player.state = 'playing';
        
        // Проверка на Black Jack
        if (player.score === 21) {
          player.state = 'finished';
          player.result = 'blackjack';
          player.winnings = Math.floor(player.bet * 2.5);
          player.balance += player.winnings;
        }
      }
    }
    
    // Дилеру 2 карты
    this.dealer.cards = [];
    this.dealer.cards.push(this.deck.pop());
    this.dealer.cards.push(this.deck.pop());
    this.dealer.hidden = true;
    this.dealer.score = this.calculateScore([this.dealer.cards[0]]); // Только первая карта видна
    
    // Если есть боты, они делают ходы автоматически
    this.processBots();
  }

  // Подсчет очков
  calculateScore(cards) {
    if (!cards || cards.length === 0) return 0;
    
    let score = 0;
    let aces = 0;
    
    for (let card of cards) {
      if (card && card.rank === 'A') {
        aces++;
        score += 11;
      } else if (card) {
        if (['J', 'Q', 'K'].includes(card.rank)) {
          score += 10;
        } else {
          score += card.value || parseInt(card.rank) || 0;
        }
      }
    }
    
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }
    
    return score;
  }

  // Действие игрока
  playerAction(playerId, action) {
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.state !== 'playing') return false;
    
    if (action === 'hit') {
      player.cards.push(this.deck.pop());
      player.score = this.calculateScore(player.cards);
      
      if (player.score > 21) {
        player.state = 'finished';
        player.result = 'lose';
        player.winnings = 0;
      }
    } else if (action === 'stand') {
      player.state = 'finished';
    } else if (action === 'double' && player.cards.length === 2 && player.balance >= player.bet) {
      player.balance -= player.bet;
      player.bet *= 2;
      player.cards.push(this.deck.pop());
      player.score = this.calculateScore(player.cards);
      player.state = 'finished';
      
      if (player.score > 21) {
        player.result = 'lose';
        player.winnings = 0;
      }
    }
    
    // Переходим к следующему игроку
    this.nextPlayer();
    
    // Если все игроки закончили, переходим к дилеру
    if (this.players.every(p => p.state === 'finished' || !p.bet)) {
      this.dealerTurn();
    }
    
    return true;
  }

  // Следующий игрок
  nextPlayer() {
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    } while (this.players[this.currentPlayerIndex].state !== 'playing' && 
             this.currentPlayerIndex !== 0);
  }

  // Обработка ботов
  processBots() {
    // Обрабатываем ботов с задержкой
    for (let player of this.players) {
      if (player.isBot && player.state === 'playing') {
        setTimeout(() => {
          // Простая логика бота
          while (player.score < 17 && player.state === 'playing') {
            const card = this.deck.pop();
            if (card) {
              player.cards.push(card);
              player.score = this.calculateScore(player.cards);
              
              if (player.score > 21) {
                player.state = 'finished';
                player.result = 'lose';
                player.winnings = 0;
                break;
              }
            }
          }
          if (player.state === 'playing') {
            player.state = 'finished';
          }
          
          // Проверяем, все ли закончили
          if (this.players.every(p => p.state === 'finished' || !p.bet)) {
            this.dealerTurn();
          }
        }, 1000);
      }
    }
  }

  // Ход дилера
  dealerTurn() {
    this.state = 'dealerTurn';
    this.dealer.hidden = false;
    this.dealer.score = this.calculateScore(this.dealer.cards);
    
    // Дилер берет до 17
    while (this.dealer.score < 17) {
      this.dealer.cards.push(this.deck.pop());
      this.dealer.score = this.calculateScore(this.dealer.cards);
    }
    
    // Определяем результаты для всех игроков
    this.determineResults();
  }

  // Определение результатов
  determineResults() {
    this.state = 'finished';
    
    for (let player of this.players) {
      if (player.result === 'blackjack' || player.result === 'lose') continue;
      
      if (player.score > 21) {
        player.result = 'lose';
        player.winnings = 0;
      } else if (this.dealer.score > 21) {
        player.result = 'win';
        player.winnings = player.bet * 2;
        player.balance += player.winnings;
      } else if (player.score > this.dealer.score) {
        player.result = 'win';
        player.winnings = player.bet * 2;
        player.balance += player.winnings;
      } else if (player.score < this.dealer.score) {
        player.result = 'lose';
        player.winnings = 0;
      } else {
        player.result = 'push';
        player.winnings = player.bet;
        player.balance += player.winnings;
      }
    }
  }

  // Новая игра
  newGame() {
    this.deck = [];
    this.dealer = { cards: [], score: 0, hidden: true };
    this.state = 'waiting';
    this.currentPlayerIndex = 0;
    
    for (let player of this.players) {
      player.cards = [];
      player.score = 0;
      player.bet = 0;
      player.state = 'waiting';
      player.choice = null;
      player.winnings = 0;
      player.result = null;
    }
  }

  // Получить состояние игры
  getGameState() {
    return {
      roomId: this.roomId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        cards: p.cards,
        score: p.score,
        bet: p.bet,
        balance: p.balance,
        state: p.state,
        result: p.result,
        winnings: p.winnings,
        isBot: p.isBot || false
      })),
      dealer: {
        cards: this.dealer.hidden ? [this.dealer.cards[0], null] : this.dealer.cards,
        score: this.dealer.hidden ? null : this.dealer.score,
        hidden: this.dealer.hidden
      },
      state: this.state,
      currentPlayerIndex: this.currentPlayerIndex
    };
  }
}

module.exports = BlackJackMultiplayerGame;

