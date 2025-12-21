const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Игровые комнаты
const rooms = new Map();
// Таймеры для комнат
const roomTimers = new Map();

// Игровая логика
class PokerGame {
  constructor(roomId, adminId) {
    this.roomId = roomId;
    this.adminId = adminId; // ID первого игрока (админ)
    this.players = [];
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.dealerIndex = 0;
    this.currentPlayerIndex = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.state = 'waiting'; // waiting, betting, flop, turn, river, showdown
    this.bets = new Map();
    this.turnTimeLeft = 30; // Время на ход в секундах
    this.turnStartTime = null;
    this.buyInAmount = 1000; // Стартовый buy-in
    this.allowedBuyIn = true; // Разрешена ли докупка фишек (управляет админ)
    this.lastRaiseIndex = -1; // Индекс последнего игрока, который сделал рейз
    this.lastRaiseSize = 0; // Размер последнего рейза
    this.gameResults = null; // Результаты последней игры
    this.autoStartNextHand = false; // Флаг для автоматического старта следующей раздачи
    this.handHistory = []; // История раздач
    this.playerStats = new Map(); // Статистика игроков
  }

  addPlayer(playerId, playerName) {
    if (this.players.length >= 6) return false;
    if (this.players.find(p => p.id === playerId)) return false;
    
    // Инициализируем статистику игрока
    if (!this.playerStats.has(playerId)) {
      this.playerStats.set(playerId, {
        handsPlayed: 0,
        handsWon: 0,
        totalProfit: 0,
        biggestWin: 0,
        biggestLoss: 0
      });
    }
    
    this.players.push({
      id: playerId,
      name: playerName,
      chips: this.buyInAmount,
      cards: [],
      folded: false,
      allIn: false,
      bet: 0,
      isBot: false,
      totalBuyIn: this.buyInAmount, // Общая сумма купленных фишек
      profit: 0 // Прибыль/убыток (chips - totalBuyIn)
    });
    return true;
  }

  addBot() {
    if (this.players.length >= 6) return false;
    if (this.players.find(p => p.isBot)) return false; // Один бот на комнату
    
    const botNames = ['Дилер Бот', 'Покерный Бот', 'ИИ Дилер', 'Бот-Игрок'];
    const botName = botNames[Math.floor(Math.random() * botNames.length)];
    
    this.players.push({
      id: 'bot_' + Date.now(),
      name: botName,
      chips: this.buyInAmount,
      cards: [],
      folded: false,
      allIn: false,
      bet: 0,
      isBot: true,
      totalBuyIn: this.buyInAmount,
      profit: 0
    });
    return true;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
  }

  // Логика принятия решений ботом
  botDecision(botPlayer) {
    if (botPlayer.folded || botPlayer.allIn) return null;

    const handStrength = this.evaluateHandStrength(botPlayer.cards, this.communityCards);
    const callAmount = this.currentBet - botPlayer.bet;
    const potOdds = callAmount > 0 ? callAmount / (this.pot + callAmount) : 0;
    
    // Агрессивность бота (0-1, где 1 - очень агрессивный)
    const aggression = 0.6;
    
    // Если очень сильная рука - рейз
    if (handStrength > 0.8) {
      const raiseAmount = Math.min(
        Math.floor(botPlayer.chips * 0.3),
        this.currentBet * 2 + this.bigBlind
      );
      if (raiseAmount > callAmount && raiseAmount <= botPlayer.chips) {
        return { action: 'raise', amount: raiseAmount };
      }
    }
    
    // Если сильная рука - колл или небольшой рейз
    if (handStrength > 0.5) {
      if (Math.random() < aggression && callAmount < botPlayer.chips * 0.2) {
        const raiseAmount = Math.min(
          Math.floor(botPlayer.chips * 0.15),
          this.currentBet * 1.5
        );
        if (raiseAmount > callAmount && raiseAmount <= botPlayer.chips) {
          return { action: 'raise', amount: raiseAmount };
        }
      }
      if (callAmount <= botPlayer.chips) {
        return { action: 'call' };
      }
    }
    
    // Если средняя рука - колл при хороших шансах банка
    if (handStrength > 0.3) {
      if (potOdds < 0.3 || callAmount === 0) {
        return { action: 'call' };
      }
      if (Math.random() < 0.3) {
        return { action: 'call' };
      }
    }
    
    // Если слабая рука - пас или колл при малой ставке
    if (callAmount === 0) {
      return { action: 'call' }; // Чек
    }
    
    if (callAmount < this.bigBlind && Math.random() < 0.2) {
      return { action: 'call' };
    }
    
    // Иначе пас
    return { action: 'fold' };
  }

  // Оценка силы руки (0-1)
  evaluateHandStrength(playerCards, communityCards) {
    if (playerCards.length < 2) return 0;
    
    const allCards = [...playerCards, ...communityCards];
    if (allCards.length < 2) {
      // Префлоп - оценка по картам
      const card1 = playerCards[0];
      const card2 = playerCards[1];
      const highCard = Math.max(card1.value, card2.value);
      const lowCard = Math.min(card1.value, card2.value);
      const isPair = card1.value === card2.value;
      const isSuited = card1.suit === card2.suit;
      
      if (isPair) {
        if (highCard >= 10) return 0.8;
        if (highCard >= 7) return 0.6;
        return 0.4;
      }
      
      if (highCard >= 12 && lowCard >= 10) return 0.7; // AK, AQ, AJ, KQ, KJ
      if (highCard === 14 && lowCard >= 9) return 0.65; // A9+
      if (highCard >= 11 && lowCard >= 9 && isSuited) return 0.55;
      if (highCard >= 10) return 0.4;
      
      return 0.2;
    }
    
    // После флопа - оценка лучшей комбинации
    if (allCards.length >= 5) {
      const bestHand = this.getBestHand(playerCards, communityCards);
      const rank = this.getHandRank(bestHand);
      
      // Нормализация ранга (примерно)
      if (rank >= 8000000) return 1.0; // Straight Flush+
      if (rank >= 7000000) return 0.95; // Four of a Kind
      if (rank >= 6000000) return 0.9; // Full House
      if (rank >= 5000000) return 0.85; // Flush
      if (rank >= 4000000) return 0.75; // Straight
      if (rank >= 3000000) return 0.65; // Three of a Kind
      if (rank >= 2000000) return 0.55; // Two Pair
      if (rank >= 1000000) return 0.45; // Pair
      return 0.3; // High Card
    }
    
    return 0.3;
  }

  createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];
    for (let suit of suits) {
      for (let rank of ranks) {
        this.deck.push({ suit, rank, value: this.getCardValue(rank) });
      }
    }
    this.shuffleDeck();
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  getCardValue(rank) {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
  }

  dealCards() {
    this.createDeck();
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.bets.clear();
    
    // Сброс состояния игроков
    this.players.forEach(player => {
      player.cards = [];
      player.folded = false;
      player.allIn = false;
      player.bet = 0;
    });

    // Раздача карт игрокам
    for (let i = 0; i < 2; i++) {
      this.players.forEach(player => {
        if (!player.folded) {
          player.cards.push(this.deck.pop());
        }
      });
    }

    // Блайнды
    const smallBlindPlayer = this.players[this.dealerIndex];
    const bigBlindPlayer = this.players[(this.dealerIndex + 1) % this.players.length];
    
    smallBlindPlayer.bet = Math.min(this.smallBlind, smallBlindPlayer.chips);
    smallBlindPlayer.chips -= smallBlindPlayer.bet;
    this.pot += smallBlindPlayer.bet;
    // Если игрок поставил все фишки в small blind, помечаем как all-in
    if (smallBlindPlayer.chips === 0) {
      smallBlindPlayer.allIn = true;
    }

    bigBlindPlayer.bet = Math.min(this.bigBlind, bigBlindPlayer.chips);
    bigBlindPlayer.chips -= bigBlindPlayer.bet;
    this.pot += bigBlindPlayer.bet;
    this.currentBet = bigBlindPlayer.bet;
    // Если игрок поставил все фишки в big blind, помечаем как all-in
    if (bigBlindPlayer.chips === 0) {
      bigBlindPlayer.allIn = true;
    }

    this.currentPlayerIndex = (this.dealerIndex + 2) % this.players.length;
    this.state = 'betting';
    this.startTurnTimer();
  }
  
  startTurnTimer() {
    this.turnStartTime = Date.now();
    this.turnTimeLeft = 30;
  }
  
  getTimeLeft() {
    if (!this.turnStartTime || this.state === 'waiting' || this.state === 'showdown') {
      return 30;
    }
    const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
    return Math.max(0, this.turnTimeLeft - elapsed);
  }

  playerAction(playerId, action, amount = 0) {
    // Валидация входных данных
    if (typeof playerId !== 'string' || !playerId) {
      console.log('Некорректный playerId:', playerId);
      return false;
    }
    if (!['fold', 'call', 'raise'].includes(action)) {
      console.log('Некорректное действие:', action);
      return false;
    }
    if (action === 'raise' && (typeof amount !== 'number' || isNaN(amount) || amount <= 0)) {
      console.log('Некорректная сумма для рейза:', amount);
      return false;
    }
    
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.id !== this.players[this.currentPlayerIndex].id) return false;
    if (player.folded) return false;
    if (player.allIn) return false; // Игрок на all-in не может действовать

    switch (action) {
      case 'fold':
        player.folded = true;
        break;
      case 'call':
        const callAmountForCall = Math.min(this.currentBet - player.bet, player.chips);
        player.bet += callAmountForCall;
        player.chips -= callAmountForCall;
        this.pot += callAmountForCall;
        if (player.chips === 0) player.allIn = true;
        break;
      case 'raise':
        // Валидация входных данных
        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
          console.log(`Некорректная сумма рейза: ${amount}`);
          return false;
        }
        
        // amount - это общая сумма ставки, которую хочет сделать игрок
        // Минимальный рейз = текущая ставка + размер последнего рейза (или big blind, если рейза не было)
        let minRaiseAmount;
        if (this.lastRaiseSize > 0) {
          // Если был рейз, минимальный рейз = currentBet + размер последнего рейза
          minRaiseAmount = this.currentBet + this.lastRaiseSize;
        } else {
          // Если рейза еще не было, минимальный рейз = currentBet + bigBlind
          minRaiseAmount = this.currentBet + this.bigBlind;
        }
        
        // Проверяем, что рейз больше или равен минимальному рейзу
        if (amount < minRaiseAmount) {
          console.log(`Рейз слишком мал: ${amount}, минимум: ${minRaiseAmount}, currentBet: ${this.currentBet}`);
          return false;
        }
        
        // Проверяем, что у игрока достаточно фишек
        const totalNeeded = amount - player.bet;
        if (totalNeeded > player.chips) {
          console.log(`Недостаточно фишек: нужно ${totalNeeded}, есть ${player.chips}`);
          return false;
        }
        
        // Вычисляем суммы
        const callAmountForRaise = Math.min(this.currentBet - player.bet, player.chips);
        const raiseAmount = amount - player.bet - callAmountForRaise;
        
        // Сначала колл до currentBet
        if (callAmountForRaise > 0) {
          player.bet += callAmountForRaise;
          player.chips -= callAmountForRaise;
          this.pot += callAmountForRaise;
        }
        
        // Потом рейз сверх currentBet
        if (raiseAmount > 0) {
          player.bet += raiseAmount;
          player.chips -= raiseAmount;
          this.pot += raiseAmount;
          const newBet = player.bet;
          const raiseSize = newBet - this.currentBet;
          this.currentBet = newBet;
          // Запоминаем, кто сделал рейз и размер рейза
          this.lastRaiseIndex = this.currentPlayerIndex;
          this.lastRaiseSize = raiseSize;
          console.log(`Игрок ${player.name} сделал рейз до ${this.currentBet} (размер рейза: ${raiseSize}), минимум был: ${minRaiseAmount}`);
        } else {
          // Если рейз не получился (amount слишком мал), откатываем колл
          if (callAmountForRaise > 0) {
            player.bet -= callAmountForRaise;
            player.chips += callAmountForRaise;
            this.pot -= callAmountForRaise;
          }
          return false;
        }
        
        if (player.chips === 0) player.allIn = true;
        break;
    }
    
    // Обновляем прибыль
    player.profit = player.chips - player.totalBuyIn;

    // Проверяем, можем ли перейти к следующему раунду ПЕРЕД переходом к следующему игроку
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если остался один активный игрок, он выигрывает
    if (activePlayers.length <= 1) {
      this.nextPlayer();
      return true;
    }
    
    // Проверяем, что все ставки равны (или игроки на all-in)
    const allBetsEqual = activePlayers.every(p => 
      (p.bet === this.currentBet) || p.allIn || p.folded
    );
    
    // Вычисляем следующий индекс игрока
    let nextIndex = this.currentPlayerIndex;
    let attempts = 0;
    do {
      nextIndex = (nextIndex + 1) % this.players.length;
      attempts++;
      if (attempts > this.players.length) break;
    } while (this.players[nextIndex].folded || this.players[nextIndex].allIn);
    
    // Если был рейз, проверяем, что следующий игрок - это тот, кто сделал рейз
    let shouldEndRound = false;
    if (this.lastRaiseIndex >= 0 && this.lastRaiseIndex < this.players.length) {
      // Раунд заканчивается, когда следующий ход - это игрок, который сделал рейз
      // И все ставки равны (то есть все уже ответили на рейз)
      if (nextIndex === this.lastRaiseIndex && allBetsEqual) {
        shouldEndRound = true;
      }
    } else {
      // Если не было рейза (первый раунд), проверяем, что все активные игроки уравняли ставки
      // И следующий игрок - это big blind
      const bigBlindIndex = (this.dealerIndex + 1) % this.players.length;
      if (nextIndex === bigBlindIndex && allBetsEqual) {
        shouldEndRound = true;
      }
    }
    
    if (shouldEndRound) {
      // Переходим к следующему раунду
      const roundChanged = this.nextRound();
      // Вызываем callback для проверки хода бота
      if (typeof this.onRoundChange === 'function') {
        this.onRoundChange();
      }
      // Также возвращаем roomId через специальное свойство для вызова checkBotMove
      return true;
    }
    
    // Переходим к следующему игроку
    this.nextPlayer();
    return true;
  }
  
  // Докупка фишек
  buyChips(playerId, amount) {
    if (!this.allowedBuyIn) return false;
    const player = this.players.find(p => p.id === playerId);
    if (!player || player.isBot) return false;
    
    player.chips += amount;
    player.totalBuyIn += amount;
    player.profit = player.chips - player.totalBuyIn;
    return true;
  }
  
  // Управление разрешением докупки (только админ)
  setBuyInAllowed(adminId, allowed) {
    if (adminId !== this.adminId) return false;
    this.allowedBuyIn = allowed;
    return true;
  }

  nextPlayer() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // Если остался один игрок, он выигрывает
    if (activePlayers.length <= 1) {
      if (activePlayers.length === 1) {
        activePlayers[0].chips += this.pot;
        activePlayers[0].profit = activePlayers[0].chips - activePlayers[0].totalBuyIn;
        this.pot = 0;
      }
      
      // Удаляем игроков с нулевыми фишками
      this.players = this.players.filter(p => {
        if (p.chips <= 0 && !p.isBot) {
          console.log(`Игрок ${p.name} выбыл из игры (нет фишек)`);
          return false;
        }
        return true;
      });
      
      // Обновляем индексы после удаления игроков
      if (this.dealerIndex >= this.players.length) {
        this.dealerIndex = 0;
      }
      
      const playersWithChips = this.players.filter(p => p.chips > 0);
      if (playersWithChips.length >= 2) {
        // Автоматически начинаем новую раздачу
        this.autoStartNextHand = true;
      }
      
      this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
      this.state = 'waiting';
      this.turnStartTime = null;
      return;
    }

    // Переход к следующему активному игроку
    let attempts = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      attempts++;
      if (attempts > this.players.length) break;
    } while (this.players[this.currentPlayerIndex].folded || 
             this.players[this.currentPlayerIndex].allIn);

    // Запускаем таймер для нового хода
    this.startTurnTimer();
  }

  // Выполнение хода бота
  makeBotMove() {
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot) return false;
    
    const decision = this.botDecision(currentPlayer);
    if (!decision) return false;
    
    // Небольшая задержка для реалистичности
    setTimeout(() => {
      this.playerAction(currentPlayer.id, decision.action, decision.amount || 0);
    }, 1000 + Math.random() * 1000);
    
    return true;
  }

  nextRound() {
    // Сбрасываем информацию о рейзах при переходе к новому раунду
    this.lastRaiseIndex = -1;
    this.lastRaiseSize = 0;
    
    if (this.state === 'betting') {
      this.state = 'flop';
      for (let i = 0; i < 3; i++) {
        this.communityCards.push(this.deck.pop());
      }
      this.resetBets();
      // resetBets уже устанавливает currentPlayerIndex на первого активного игрока
    } else if (this.state === 'flop') {
      this.state = 'turn';
      this.communityCards.push(this.deck.pop());
      this.resetBets();
    } else if (this.state === 'turn') {
      this.state = 'river';
      this.communityCards.push(this.deck.pop());
      this.resetBets();
    } else if (this.state === 'river') {
      this.state = 'showdown';
      const results = this.evaluateHands();
      this.gameResults = results;
      
      // Если игра должна продолжиться автоматически, устанавливаем флаг
      if (results && results.continueGame) {
        this.autoStartNextHand = true;
      }
    }
    // Возвращаем true, чтобы сервер мог проверить ход бота
    return true;
  }

  resetBets() {
    this.players.forEach(p => p.bet = 0);
    this.currentBet = 0;
    this.lastRaiseIndex = -1; // Сбрасываем при новом раунде
    // Начинаем с дилера, но пропускаем сложенных игроков
    this.currentPlayerIndex = this.dealerIndex;
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 1) {
      this.state = 'showdown';
      const results = this.evaluateHands();
      this.gameResults = results;
    } else {
      // Переходим к первому активному игроку после дилера
      let attempts = 0;
      while ((this.players[this.currentPlayerIndex].folded || 
              this.players[this.currentPlayerIndex].allIn) && 
             attempts < this.players.length) {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        attempts++;
      }
      // Запускаем таймер для нового раунда
      this.startTurnTimer();
    }
  }

  getHandName(rank) {
    if (rank >= 9000000) return 'Роял-флэш';
    if (rank >= 8000000) return 'Стрит-флэш';
    if (rank >= 7000000) return 'Каре';
    if (rank >= 6000000) return 'Фулл-хаус';
    if (rank >= 5000000) return 'Флэш';
    if (rank >= 4000000) return 'Стрит';
    if (rank >= 3000000) return 'Тройка';
    if (rank >= 2000000) return 'Две пары';
    if (rank >= 1000000) return 'Пара';
    return 'Старшая карта';
  }

  // Расчет side pots при all-in
  calculateSidePots() {
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 0) return [];

    // Собираем все уникальные суммы ставок (включая всех игроков, которые делали ставки)
    const allBets = this.players.map(p => p.bet).filter(b => b > 0);
    if (allBets.length === 0) return [];
    
    const betAmounts = [...new Set(allBets)].sort((a, b) => a - b);
    const sidePots = [];

    for (let i = 0; i < betAmounts.length; i++) {
      const potLevel = betAmounts[i];
      const prevLevel = i > 0 ? betAmounts[i - 1] : 0;
      const levelContribution = potLevel - prevLevel;

      // Считаем, сколько игроков участвовало на этом уровне (включая тех, кто уже спасовал)
      const playersAtLevel = this.players.filter(p => p.bet >= potLevel);
      const potSize = playersAtLevel.length * levelContribution;

      if (potSize > 0) {
        sidePots.push({
          level: potLevel,
          size: potSize,
          eligiblePlayers: playersAtLevel.map(p => p.id)
        });
      }
    }

    return sidePots;
  }

  evaluateHands() {
    const activePlayers = this.players.filter(p => !p.folded);
    if (activePlayers.length === 0) return null;

    const hands = activePlayers.map(player => {
      const bestHand = this.getBestHand(player.cards, this.communityCards);
      const rank = this.getHandRank(bestHand);
      return {
        player,
        hand: bestHand,
        rank: rank,
        handName: this.getHandName(rank)
      };
    });

    hands.sort((a, b) => b.rank - a.rank);
    
    // Расчет side pots
    const sidePots = this.calculateSidePots();
    const winners = [];
    
    if (sidePots.length > 0) {
      // Распределяем side pots
      for (const sidePot of sidePots) {
        // Находим лучшие руки среди игроков, имеющих право на этот pot
        const eligibleHands = hands.filter(h => 
          sidePot.eligiblePlayers.includes(h.player.id)
        );
        
        if (eligibleHands.length === 0) continue;
        
        // Находим максимальный ранг
        const maxRank = eligibleHands[0].rank;
        const winnersAtLevel = eligibleHands.filter(h => h.rank === maxRank);
        
        // Делим pot поровну между победителями
        const potPerWinner = Math.floor(sidePot.size / winnersAtLevel.length);
        const remainder = sidePot.size % winnersAtLevel.length;
        
        winnersAtLevel.forEach((winner, index) => {
          const chipsWon = potPerWinner + (index < remainder ? 1 : 0);
          winner.player.chips += chipsWon;
          winner.player.profit = winner.player.chips - winner.player.totalBuyIn;
          
          winners.push({
            player: winner.player,
            chipsWon: chipsWon,
            hand: winner.hand,
            handName: winner.handName,
            potLevel: sidePot.level
          });
        });
      }
    } else {
      // Обычный случай - нет all-in, один main pot
      const maxRank = hands[0].rank;
      const winnersAtLevel = hands.filter(h => h.rank === maxRank);
      
      // Делим pot поровну между победителями
      const potPerWinner = Math.floor(this.pot / winnersAtLevel.length);
      const remainder = this.pot % winnersAtLevel.length;
      
      winnersAtLevel.forEach((winner, index) => {
        const chipsWon = potPerWinner + (index < remainder ? 1 : 0);
        winner.player.chips += chipsWon;
        winner.player.profit = winner.player.chips - winner.player.totalBuyIn;
        
        winners.push({
          player: winner.player,
          chipsWon: chipsWon,
          hand: winner.hand,
          handName: winner.handName,
          potLevel: this.pot
        });
      });
    }
    
    this.pot = 0;

    // Обновляем прибыль всех игроков и статистику
    this.players.forEach(p => {
      const oldProfit = p.profit || 0;
      p.profit = p.chips - p.totalBuyIn;
      
      // Обновляем статистику
      if (!p.isBot && this.playerStats.has(p.id)) {
        const stats = this.playerStats.get(p.id);
        stats.handsPlayed++;
        if (p.profit > oldProfit) {
          stats.handsWon++;
          const winAmount = p.profit - oldProfit;
          if (winAmount > stats.biggestWin) {
            stats.biggestWin = winAmount;
          }
        } else if (p.profit < oldProfit) {
          const lossAmount = oldProfit - p.profit;
          if (lossAmount > stats.biggestLoss) {
            stats.biggestLoss = lossAmount;
          }
        }
        stats.totalProfit = p.profit;
      }
    });
    
    // Сохраняем историю раздачи
    this.handHistory.push({
      timestamp: Date.now(),
      winners: winners.map(w => ({
        name: w.player.name,
        chipsWon: w.chipsWon
      })),
      pot: sidePots.length > 0 ? sidePots.reduce((sum, pot) => sum + pot.size, 0) : this.pot,
      playersCount: activePlayers.length
    });
    
    // Ограничиваем историю последними 50 раздачами
    if (this.handHistory.length > 50) {
      this.handHistory.shift();
    }

    // Следующий дилер
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    
    // Удаляем игроков с нулевыми фишками
    this.players = this.players.filter(p => {
      if (p.chips <= 0 && !p.isBot) {
        console.log(`Игрок ${p.name} выбыл из игры (нет фишек)`);
        return false;
      }
      return true;
    });
    
    // Обновляем индексы после удаления игроков
    if (this.dealerIndex >= this.players.length) {
      this.dealerIndex = 0;
    }
    
    // Проверяем, можем ли продолжить игру
    const playersWithChips = this.players.filter(p => p.chips > 0);
    if (playersWithChips.length >= 2) {
      // Автоматически начинаем новую раздачу через 3 секунды (чтобы показать результаты)
      this.state = 'waiting';
      this.turnStartTime = null;
      // Флаг для автоматического старта новой раздачи
      this.autoStartNextHand = true;
    } else {
      // Недостаточно игроков - переходим в ожидание
      this.state = 'waiting';
      this.turnStartTime = null;
      this.autoStartNextHand = false;
      if (playersWithChips.length === 1) {
        console.log(`Игра окончена. Победитель: ${playersWithChips[0].name} с ${playersWithChips[0].chips} фишками`);
      }
    }

    // Возвращаем информацию о результатах
    return {
      winners: winners.map(w => ({
        name: w.player.name,
        id: w.player.id,
        hand: w.hand,
        handName: w.handName,
        chipsWon: w.chipsWon,
        potLevel: w.potLevel
      })),
      allHands: hands.map(h => ({
        playerName: h.player.name,
        playerId: h.player.id,
        hand: h.hand,
        handName: h.handName,
        rank: h.rank
      })),
      sidePots: sidePots,
      continueGame: playersWithChips.length >= 2
    };
  }

  getBestHand(playerCards, communityCards) {
    const allCards = [...playerCards, ...communityCards];
    if (allCards.length < 5) return [];
    
    const combinations = this.getCombinations(allCards, 5);
    let bestHand = combinations[0] || [];
    let bestRank = 0;

    for (let combo of combinations) {
      const rank = this.getHandRank(combo);
      if (rank > bestRank) {
        bestRank = rank;
        bestHand = combo;
      }
    }
    return bestHand;
  }

  getCombinations(cards, k) {
    if (k === 0) return [[]];
    if (cards.length === 0) return [];
    
    const [first, ...rest] = cards;
    const withFirst = this.getCombinations(rest, k - 1).map(combo => [first, ...combo]);
    const withoutFirst = this.getCombinations(rest, k);
    return [...withFirst, ...withoutFirst];
  }

  getHandRank(cards) {
    if (!cards || cards.length !== 5) return 0;
    const allCards = cards;

    const ranks = allCards.map(c => c.value).sort((a, b) => b - a);
    const suits = allCards.map(c => c.suit);
    const rankCounts = {};
    ranks.forEach(r => rankCounts[r] = (rankCounts[r] || 0) + 1);
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    const isFlush = suits.every(s => s === suits[0]);
    const isStraight = this.isStraight(ranks);

    // Royal Flush
    if (isFlush && isStraight && ranks[0] === 14 && ranks[4] === 10) return 9000000;
    // Straight Flush
    if (isFlush && isStraight) return 8000000 + ranks[0];
    // Four of a Kind
    if (counts[0] === 4) {
      const fourOfKindRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 4));
      const kicker = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 1));
      return 7000000 + fourOfKindRank * 100 + kicker;
    }
    // Full House
    if (counts[0] === 3 && counts[1] === 2) {
      const threeRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3));
      const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2));
      return 6000000 + threeRank * 100 + pairRank;
    }
    // Flush
    if (isFlush) {
      // Учитываем все карты для сравнения флешей
      let flushRank = 5000000;
      ranks.forEach((r, i) => {
        flushRank += r * Math.pow(100, 4 - i);
      });
      return flushRank;
    }
    // Straight
    if (isStraight) return 4000000 + ranks[0];
    // Three of a Kind
    if (counts[0] === 3) {
      const threeRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 3));
      const kickers = Object.keys(rankCounts)
        .filter(k => rankCounts[k] === 1)
        .map(k => parseInt(k))
        .sort((a, b) => b - a);
      return 3000000 + threeRank * 10000 + kickers[0] * 100 + (kickers[1] || 0);
    }
    // Two Pair
    if (counts[0] === 2 && counts[1] === 2) {
      const pairs = Object.keys(rankCounts)
        .filter(k => rankCounts[k] === 2)
        .map(k => parseInt(k))
        .sort((a, b) => b - a);
      const kicker = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 1));
      return 2000000 + pairs[0] * 10000 + pairs[1] * 100 + kicker;
    }
    // Pair
    if (counts[0] === 2) {
      const pairRank = parseInt(Object.keys(rankCounts).find(k => rankCounts[k] === 2));
      const kickers = Object.keys(rankCounts)
        .filter(k => rankCounts[k] === 1)
        .map(k => parseInt(k))
        .sort((a, b) => b - a);
      return 1000000 + pairRank * 1000000 + kickers[0] * 10000 + kickers[1] * 100 + (kickers[2] || 0);
    }
    // High Card - учитываем все карты
    let highCardRank = 0;
    ranks.forEach((r, i) => {
      highCardRank += r * Math.pow(100, 4 - i);
    });
    return highCardRank;
  }

  isStraight(ranks) {
    const sorted = [...new Set(ranks)].sort((a, b) => b - a);
    if (sorted.length < 5) return false;
    for (let i = 0; i <= sorted.length - 5; i++) {
      let straight = true;
      for (let j = 1; j < 5; j++) {
        if (sorted[i + j] !== sorted[i] - j) {
          straight = false;
          break;
        }
      }
      if (straight) return true;
    }
    // A-2-3-4-5 straight
    if (sorted.includes(14) && sorted.includes(5) && sorted.includes(4) && 
        sorted.includes(3) && sorted.includes(2)) return true;
    return false;
  }

  getGameState() {
    const state = {
      players: this.players.map(p => {
        const playerData = {
          id: p.id,
          name: p.name,
          chips: p.chips,
          bet: p.bet,
          folded: p.folded,
          allIn: p.allIn,
          cards: p.cards,
          isBot: p.isBot,
          totalBuyIn: p.totalBuyIn,
          profit: p.profit
        };
        
        // Добавляем статистику, если есть
        if (this.playerStats.has(p.id)) {
          playerData.stats = this.playerStats.get(p.id);
        }
        
        return playerData;
      }),
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      state: this.state,
      dealerIndex: this.dealerIndex,
      timeLeft: this.getTimeLeft(),
      adminId: this.adminId,
      allowedBuyIn: this.allowedBuyIn,
      buyInAmount: this.buyInAmount,
      gameResults: this.gameResults,
      handHistory: this.handHistory.slice(-10), // Последние 10 раздач
      smallBlind: this.smallBlind,
      bigBlind: this.bigBlind
    };
    
    // Очищаем результаты после отправки
    if (this.gameResults) {
      this.gameResults = null;
    }
    
    return state;
  }
}

// Функция для получения списка всех комнат
function getRoomsList() {
  return Array.from(rooms.entries()).map(([roomId, game]) => ({
    roomId,
    playersCount: game.players.length,
    maxPlayers: 6,
    state: game.state,
    pot: game.pot,
    players: game.players.map(p => ({
      name: p.name,
      chips: p.chips,
      isBot: p.isBot
    })),
    adminName: game.players.find(p => p.id === game.adminId)?.name || 'Unknown'
  }));
}

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  // Отправляем список комнат при подключении
  socket.emit('roomsList', getRoomsList());

  socket.on('getRoomsList', () => {
    socket.emit('roomsList', getRoomsList());
  });

  socket.on('createRoom', (roomId) => {
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new PokerGame(roomId, socket.id));
      // Уведомляем всех о новом списке комнат
      io.emit('roomsList', getRoomsList());
    }
    socket.join(roomId);
    socket.emit('roomJoined', roomId);
  });

  socket.on('joinRoom', (data) => {
    const { roomId, playerName } = data;
    const game = rooms.get(roomId);
    
    if (!game) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (game.addPlayer(socket.id, playerName)) {
      socket.join(roomId);
      socket.emit('joinedRoom', roomId);
      
      // Автоматически добавляем бота, если игрок один
      if (game.players.length === 1 && !game.players.some(p => p.isBot)) {
        game.addBot();
      }
      
      io.to(roomId).emit('gameState', game.getGameState());
      // Обновляем список комнат для всех
      io.emit('roomsList', getRoomsList());
    } else {
      socket.emit('error', 'Cannot join room');
    }
  });

  socket.on('addBot', (roomId) => {
    const game = rooms.get(roomId);
    if (game && game.addBot()) {
      io.to(roomId).emit('gameState', game.getGameState());
      io.emit('roomsList', getRoomsList());
    }
  });

  socket.on('startGame', (roomId) => {
    console.log('Получен запрос на начало игры в комнате:', roomId);
    const game = rooms.get(roomId);
    if (!game) {
      console.error('Комната не найдена:', roomId);
      socket.emit('error', 'Комната не найдена');
      return;
    }
    if (game.players.length < 2) {
      console.error('Недостаточно игроков:', game.players.length);
      socket.emit('error', 'Нужно минимум 2 игрока для начала игры');
      return;
    }
    console.log('Начинаем игру. Игроков:', game.players.length);
    game.dealCards();
    const state = game.getGameState();
    console.log('Состояние игры после раздачи:', state.state, 'Карт у игроков:', state.players.map(p => p.cards.length));
    io.to(roomId).emit('gameState', state);
    
    // Устанавливаем callback для смены раунда
    game.onRoundChange = () => {
      console.log('Раунд изменился, проверяем ход бота для комнаты:', roomId);
      setTimeout(() => {
        checkBotMove(roomId);
      }, 1500);
    };
    
    // Проверяем, нужно ли боту сделать ход
    setTimeout(() => {
      checkBotMove(roomId);
    }, 500);
    
    // После первой раздачи игра будет продолжаться автоматически
    game.autoStartNextHand = true;
  });

  // Функция для автоматического запуска новой раздачи
  function autoStartNextHand(roomId) {
    const game = rooms.get(roomId);
    if (!game) return;
    
    if (game.state === 'waiting' && game.autoStartNextHand) {
      const playersWithChips = game.players.filter(p => p.chips > 0);
      if (playersWithChips.length >= 2) {
        // Запускаем новую раздачу через 3 секунды (чтобы показать результаты)
        setTimeout(() => {
          game.autoStartNextHand = false;
          game.dealCards();
          const newState = game.getGameState();
          io.to(roomId).emit('gameState', newState);
          
          // Устанавливаем callback для смены раунда
          game.onRoundChange = () => {
            console.log('Раунд изменился (autoStart), проверяем ход бота для комнаты:', roomId);
            setTimeout(() => {
              checkBotMove(roomId);
            }, 1500);
          };
          
          // Проверяем, нужно ли боту сделать ход
          setTimeout(() => {
            checkBotMove(roomId);
          }, 500);
          
          // Устанавливаем флаг для автоматического продолжения игры
          game.autoStartNextHand = true;
        }, 3000);
      } else {
        game.autoStartNextHand = false;
      }
    }
  }

  socket.on('playerAction', (data) => {
    const { roomId, action, amount } = data;
    const game = rooms.get(roomId);
    
    if (game && game.playerAction(socket.id, action, amount)) {
      const state = game.getGameState();
      io.to(roomId).emit('gameState', state);
      
      // Проверяем, нужно ли автоматически начать новую раздачу
      autoStartNextHand(roomId);
      
      // Проверяем, нужно ли боту сделать ход
      setTimeout(() => {
        checkBotMove(roomId);
      }, 1500);
    }
  });

  socket.on('buyChips', (data) => {
    const { roomId, amount } = data;
    const game = rooms.get(roomId);
    
    if (game && game.buyChips(socket.id, amount)) {
      io.to(roomId).emit('gameState', game.getGameState());
    }
  });

  socket.on('setBuyInAllowed', (data) => {
    const { roomId, allowed } = data;
    const game = rooms.get(roomId);
    
    if (game && game.setBuyInAllowed(socket.id, allowed)) {
      io.to(roomId).emit('gameState', game.getGameState());
    }
  });

  // Функция для проверки и выполнения хода бота
  function checkBotMove(roomId) {
    const game = rooms.get(roomId);
    if (!game) {
      console.log('Игра не найдена для комнаты:', roomId);
      return;
    }
    
    if (game.state === 'waiting' || game.state === 'showdown') {
      // Если игра в состоянии waiting или showdown, проверяем, нужно ли начать новую раздачу
      if (game.state === 'waiting') {
        autoStartNextHand(roomId);
      }
      return;
    }
    
    const currentPlayer = game.players[game.currentPlayerIndex];
    console.log('Проверка хода бота. Текущий игрок:', currentPlayer ? currentPlayer.name : 'не найден', 
                'Индекс:', game.currentPlayerIndex, 
                'Состояние:', game.state,
                'isBot:', currentPlayer ? currentPlayer.isBot : false);
    
    if (currentPlayer && currentPlayer.isBot && !currentPlayer.folded && !currentPlayer.allIn) {
      const decision = game.botDecision(currentPlayer);
      console.log('Решение бота:', decision);
      if (decision) {
        // Выполняем ход бота с небольшой задержкой для реалистичности
        const delay = 500 + Math.random() * 1000; // От 0.5 до 1.5 секунд
        setTimeout(() => {
          // Проверяем, что игра все еще активна и это все еще ход бота
          const gameCheck = rooms.get(roomId);
          if (!gameCheck) return;
          const currentPlayerCheck = gameCheck.players[gameCheck.currentPlayerIndex];
          if (currentPlayerCheck && currentPlayerCheck.id === currentPlayer.id && 
              !currentPlayerCheck.folded && !currentPlayerCheck.allIn) {
            if (gameCheck.playerAction(currentPlayer.id, decision.action, decision.amount || 0)) {
              const state = gameCheck.getGameState();
              io.to(roomId).emit('gameState', state);
              
              // Проверяем, нужно ли автоматически начать новую раздачу
              autoStartNextHand(roomId);
              
              // Рекурсивно проверяем следующий ход
              setTimeout(() => {
                checkBotMove(roomId);
              }, 1000);
            } else {
              // Если действие не удалось, пробуем еще раз через секунду
              console.log('Действие бота не удалось, пробуем еще раз');
              setTimeout(() => {
                checkBotMove(roomId);
              }, 1000);
            }
          }
        }, delay);
      } else {
        // Если бот не может принять решение, пробуем еще раз через секунду
        console.log('Бот не может принять решение, пробуем еще раз');
        setTimeout(() => {
          checkBotMove(roomId);
        }, 1000);
      }
    }
  }

  // Таймер для отправки обновлений времени и проверки хода бота
  setInterval(() => {
    rooms.forEach((game, roomId) => {
      if (game.state !== 'waiting' && game.state !== 'showdown') {
        const timeLeft = game.getTimeLeft();
        if (timeLeft <= 0) {
          // Время вышло - автоматически пас
          const currentPlayer = game.players[game.currentPlayerIndex];
          if (currentPlayer && !currentPlayer.isBot && !currentPlayer.folded && !currentPlayer.allIn) {
            game.playerAction(currentPlayer.id, 'fold');
            const state = game.getGameState();
            io.to(roomId).emit('gameState', state);
            
            // Проверяем, нужно ли автоматически начать новую раздачу
            autoStartNextHand(roomId);
            
            setTimeout(() => {
              checkBotMove(roomId);
            }, 500);
          }
        } else {
          // Отправляем обновление времени
          io.to(roomId).emit('timeUpdate', { timeLeft, currentPlayerIndex: game.currentPlayerIndex });
        }
        
        // Периодически проверяем, нужно ли боту сделать ход (каждые 2 секунды)
        const currentPlayer = game.players[game.currentPlayerIndex];
        if (currentPlayer && currentPlayer.isBot && !currentPlayer.folded && !currentPlayer.allIn) {
          // Проверяем, не застрял ли бот (если прошло больше 3 секунд с начала хода)
          const timeSinceTurnStart = Date.now() - (game.turnStartTime || 0);
          if (timeSinceTurnStart > 3000) {
            checkBotMove(roomId);
          }
        }
      }
    });
  }, 1000);

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    rooms.forEach((game, roomId) => {
      const player = game.players.find(p => p.id === socket.id);
      if (player) {
        // Если игрок отключился во время игры, он автоматически пасует
        if (game.state !== 'waiting' && game.state !== 'showdown' && !player.folded) {
          player.folded = true;
          // Если это был текущий игрок, переходим к следующему
          if (game.currentPlayerIndex < game.players.length && 
              game.players[game.currentPlayerIndex] && 
              game.players[game.currentPlayerIndex].id === socket.id) {
            game.nextPlayer();
          }
        }
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('gameState', game.getGameState());
        }
        // Обновляем список комнат
        io.emit('roomsList', getRoomsList());
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Слушаем на всех интерфейсах
server.listen(PORT, HOST, () => {
  console.log(`🚀 Poker server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`🌐 Public: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  } else if (process.env.RENDER_EXTERNAL_URL) {
    console.log(`🌐 Public: ${process.env.RENDER_EXTERNAL_URL}`);
  } else {
    console.log(`🌐 Share your public IP/domain with friends!`);
  }
});

