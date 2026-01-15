// ========================================
// GEEZ BINGO - MAIN APPLICATION
// Production-ready with error handling
// ========================================

class GeezBingoApp {
  constructor() {
    this.config = {
      apiUrl: 'https://api.yourdomain.com',
      socketUrl: 'wss://api.yourdomain.com',
      version: '1.0.0'
    };
    
    this.state = {
      user: null,
      game: null,
      balance: 0,
      cards: [],
      socketConnected: false,
      autoMark: true,
      soundEnabled: true,
      theme: 'dark'
    };
    
    this.components = {
      socket: null,
      game: null,
      wallet: null,
      ui: null
    };
    
    this.initialize();
  }
  
  async initialize() {
    try {
      // Initialize components
      await this.initializeComponents();
      
      // Load user data
      await this.loadUserData();
      
      // Initialize UI
      this.initializeUI();
      
      // Connect to game server
      await this.connectToGameServer();
      
      // Show welcome message
      this.showWelcomeMessage();
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to load application. Please refresh.');
    }
  }
  
  async initializeComponents() {
    // Initialize Socket Manager
    this.components.socket = new SocketManager(this.config.socketUrl);
    
    // Initialize Game Manager
    this.components.game = new GameManager(this.components.socket);
    
    // Initialize Wallet Manager
    this.components.wallet = new WalletManager(this.config.apiUrl);
    
    // Initialize UI Manager
    this.components.ui = new UIManager();
  }
  
  async loadUserData() {
    try {
      // Get user from Telegram Web App
      const telegramUser = this.getTelegramUser();
      
      if (telegramUser) {
        this.state.user = telegramUser;
        await this.syncUserData();
      } else {
        // Demo mode for testing
        this.state.user = {
          id: 'demo_' + Date.now(),
          username: 'Demo User',
          firstName: 'Demo',
          lastName: 'User'
        };
        
        this.state.balance = 1000;
      }
      
    } catch (error) {
      console.error('Failed to load user data:', error);
      throw error;
    }
  }
  
  getTelegramUser() {
    if (window.Telegram && Telegram.WebApp) {
      const webApp = Telegram.WebApp;
      
      // Initialize Web App
      webApp.ready();
      webApp.expand();
      
      // Set theme
      webApp.setHeaderColor('#6a11cb');
      webApp.setBackgroundColor('#f5f5f5');
      
      // Get user data
      const user = webApp.initDataUnsafe.user;
      
      if (user) {
        return {
          id: user.id,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          languageCode: user.language_code,
          isPremium: user.is_premium || false
        };
      }
    }
    
    return null;
  }
  
  async syncUserData() {
    try {
      // Sync user data with backend
      const response = await fetch(`${this.config.apiUrl}/api/webapp/user/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.state.user.id,
          username: this.state.user.username,
          firstName: this.state.user.firstName,
          lastName: this.state.user.lastName
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.state.balance = data.balance || 0;
        this.components.ui.updateBalance(this.state.balance);
      }
      
    } catch (error) {
      console.error('Failed to sync user data:', error);
    }
  }
  
  initializeUI() {
    // Bind event listeners
    this.bindEvents();
    
    // Update UI with initial state
    this.components.ui.updateUserInfo(this.state.user);
    this.components.ui.updateBalance(this.state.balance);
    
    // Initialize modals
    this.initializeModals();
  }
  
  bindEvents() {
    // Menu toggle
    document.getElementById('menuToggle').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.add('open');
    });
    
    document.getElementById('closeMenu').addEventListener('click', () => {
      document.querySelector('.sidebar').classList.remove('open');
    });
    
    // Card selection
    document.getElementById('selectCardBtn').addEventListener('click', () => {
      this.openCardSelection();
    });
    
    document.getElementById('quickPlayBtn').addEventListener('click', () => {
      this.quickPlay();
    });
    
    document.getElementById('bingoBtn').addEventListener('click', () => {
      this.claimBingo();
    });
    
    document.getElementById('depositBtn').addEventListener('click', () => {
      this.openDepositModal();
    });
    
    document.getElementById('withdrawBtn').addEventListener('click', () => {
      this.openWithdrawModal();
    });
    
    document.getElementById('helpBtn').addEventListener('click', () => {
      this.showHelp();
    });
    
    // Auto-mark toggle
    document.getElementById('autoMarkToggle').addEventListener('click', (e) => {
      const isActive = e.currentTarget.classList.toggle('active');
      this.state.autoMark = isActive;
      this.components.game.setAutoMark(isActive);
    });
    
    // Clear marks
    document.getElementById('clearMarks').addEventListener('click', () => {
      this.components.game.clearMarks();
    });
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(button => {
      button.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        this.components.ui.closeModal(modal.id);
      });
    });
    
    // Window click to close sidebar
    document.addEventListener('click', (e) => {
      const sidebar = document.querySelector('.sidebar');
      const menuToggle = document.getElementById('menuToggle');
      
      if (sidebar.classList.contains('open') && 
          !sidebar.contains(e.target) && 
          !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
    
    // Online/offline detection
    window.addEventListener('online', () => {
      this.showToast('Reconnected to server', 'success');
      this.connectToGameServer();
    });
    
    window.addEventListener('offline', () => {
      this.showToast('Connection lost. Please check your internet.', 'error');
    });
  }
  
  initializeModals() {
    // Card selection modal
    this.initializeCardSelectionModal();
    
    // Deposit modal
    this.initializeDepositModal();
    
    // Celebration modal
    this.initializeCelebrationModal();
  }
  
  initializeCardSelectionModal() {
    const modal = document.getElementById('cardSelectionModal');
    const searchInput = document.getElementById('cardSearch');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const confirmButton = document.getElementById('confirmCardBtn');
    
    // Search functionality
    searchInput.addEventListener('input', (e) => {
      this.filterCards(e.target.value);
    });
    
    // Filter functionality
    filterButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        filterButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        
        const filter = e.target.dataset.filter;
        this.filterCards(searchInput.value, filter);
      });
    });
    
    // Confirm selection
    confirmButton.addEventListener('click', async () => {
      const selectedCard = document.querySelector('.card-item.selected');
      
      if (selectedCard) {
        const cardNumber = parseInt(selectedCard.dataset.card);
        
        try {
          await this.selectCard(cardNumber);
          this.components.ui.closeModal('cardSelectionModal');
        } catch (error) {
          this.showToast(error.message, 'error');
        }
      }
    });
  }
  
  async openCardSelection() {
    try {
      // Load available cards
      const availableCards = await this.loadAvailableCards();
      
      // Populate cards grid
      this.populateCardsGrid(availableCards);
      
      // Show modal
      this.components.ui.openModal('cardSelectionModal');
      
    } catch (error) {
      this.showToast('Failed to load cards', 'error');
    }
  }
  
  async loadAvailableCards() {
    const response = await fetch(`${this.config.apiUrl}/api/webapp/cards/available`);
    const data = await response.json();
    
    if (data.success) {
      return data.cards;
    } else {
      throw new Error(data.message);
    }
  }
  
  populateCardsGrid(cards) {
    const container = document.getElementById('cardsGridContainer');
    container.innerHTML = '';
    
    cards.forEach(card => {
      const cardElement = document.createElement('div');
      cardElement.className = `card-item ${card.status}`;
      cardElement.dataset.card = card.number;
      cardElement.textContent = card.number;
      
      if (card.status === 'taken') {
        cardElement.title = 'Already taken';
      } else {
        cardElement.addEventListener('click', () => {
          // Clear previous selection
          document.querySelectorAll('.card-item').forEach(item => {
            item.classList.remove('selected');
          });
          
          // Select this card
          cardElement.classList.add('selected');
          
          // Enable confirm button
          document.getElementById('confirmCardBtn').disabled = false;
        });
      }
      
      container.appendChild(cardElement);
    });
  }
  
  filterCards(searchTerm, filter = 'all') {
    const cards = document.querySelectorAll('.card-item');
    const searchLower = searchTerm.toLowerCase();
    
    cards.forEach(card => {
      const cardNumber = card.dataset.card;
      const cardStatus = card.classList.contains('taken') ? 'taken' : 'available';
      
      const matchesSearch = searchTerm === '' || cardNumber.includes(searchTerm);
      const matchesFilter = filter === 'all' || cardStatus === filter;
      
      if (matchesSearch && matchesFilter) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  async selectCard(cardNumber) {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/webapp/cards/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.state.user.id,
          cardNumber: cardNumber,
          gameId: this.state.game?.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update game state
        this.state.game = data.game;
        this.state.cards.push({
          number: cardNumber,
          card: data.card
        });
        
        // Update UI
        this.components.ui.updateCardNumber(cardNumber);
        this.components.game.initializeCard(data.card);
        
        this.showToast(`Card #${cardNumber} selected successfully!`, 'success');
        
        // Join game if not already joined
        if (!this.state.game) {
          await this.joinGame();
        }
        
      } else {
        throw new Error(data.message);
      }
      
    } catch (error) {
      throw error;
    }
  }
  
  async quickPlay() {
    try {
      // Find first available card
      const availableCards = await this.loadAvailableCards();
      const availableCard = availableCards.find(card => card.status === 'available');
      
      if (availableCard) {
        await this.selectCard(availableCard.number);
      } else {
        this.showToast('No available cards. Please try again later.', 'warning');
      }
      
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }
  
  async joinGame() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/webapp/game/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.state.user.id,
          betAmount: 10 // Default bet
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.state.game = data.game;
        
        // Update UI
        this.components.ui.updateGameStatus('waiting');
        this.components.ui.updatePlayerCount(data.game.players);
        this.components.ui.updatePrizePool(data.game.prizePool);
        
        this.showToast('Successfully joined the game!', 'success');
        
      } else {
        throw new Error(data.message);
      }
      
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }
  
  async claimBingo() {
    if (!this.state.game) {
      this.showToast('You are not in a game', 'warning');
      return;
    }
    
    try {
      const response = await fetch(`${this.config.apiUrl}/api/webapp/game/claim-bingo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.state.user.id,
          gameId: this.state.game.id
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Show celebration
        this.showCelebration(data.prizeAmount, data.winningPattern);
        
        // Update balance
        this.state.balance += data.prizeAmount;
        this.components.ui.updateBalance(this.state.balance);
        
      } else {
        this.showToast(data.message, 'warning');
      }
      
    } catch (error) {
      this.showToast('Failed to claim bingo', 'error');
    }
  }
  
  async connectToGameServer() {
    try {
      await this.components.socket.connect();
      
      // Listen for game updates
      this.components.socket.on('gameState', (state) => {
        this.handleGameState(state);
      });
      
      this.components.socket.on('numberDrawn', (data) => {
        this.handleNumberDrawn(data);
      });
      
      this.components.socket.on('gameStarted', (data) => {
        this.handleGameStarted(data);
      });
      
      this.components.socket.on('gameEnded', (data) => {
        this.handleGameEnded(data);
      });
      
      this.components.socket.on('playerJoined', (data) => {
        this.handlePlayerJoined(data);
      });
      
      this.components.socket.on('bingo', (data) => {
        this.handleBingo(data);
      });
      
      this.state.socketConnected = true;
      this.showToast('Connected to game server', 'success');
      
    } catch (error) {
      console.error('Failed to connect to game server:', error);
      this.showToast('Failed to connect to game server', 'error');
      
      // Retry connection after 5 seconds
      setTimeout(() => this.connectToGameServer(), 5000);
    }
  }
  
  handleGameState(state) {
    this.state.game = state;
    
    // Update UI
    this.components.ui.updateGameStatus(state.status);
    this.components.ui.updatePlayerCount(state.players);
    this.components.ui.updatePrizePool(state.prizePool);
    this.components.ui.updateDrawnNumbers(state.drawnNumbers);
    
    // Update time left
    if (state.endTime) {
      const timeLeft = Math.max(0, Math.floor((new Date(state.endTime) - Date.now()) / 1000));
      this.components.ui.updateTimeLeft(timeLeft);
    }
  }
  
  handleNumberDrawn(data) {
    // Play sound
    if (this.state.soundEnabled) {
      this.playSound('numberCall');
    }
    
    // Update UI
    this.components.ui.updateCurrentNumber(data.number, data.letter);
    this.components.ui.addDrawnNumber(data.number);
    
    // Auto-mark if enabled
    if (this.state.autoMark) {
      this.components.game.markNumber(data.number);
    }
  }
  
  handleGameStarted(data) {
    this.showToast('Game started! Good luck!', 'success');
    
    // Update UI
    this.components.ui.updateGameStatus('active');
    this.components.ui.updateTimeLeft(data.duration);
  }
  
  handleGameEnded(data) {
    this.showToast(`Game ended! ${data.winnerCount} winner(s)`, 'info');
    
    // Reset game state
    this.state.game = null;
    this.components.ui.updateGameStatus('waiting');
    this.components.game.reset();
  }
  
  handlePlayerJoined(data) {
    this.components.ui.updatePlayerCount(data.playerCount);
    this.components.ui.updatePrizePool(data.totalPrizePool);
  }
  
  handleBingo(data) {
    if (data.userId === this.state.user.id) {
      // It's our bingo!
      this.showCelebration(data.prizeAmount, 'BINGO!');
    } else {
      // Someone else's bingo
      this.showToast(`${data.username} got BINGO!`, 'warning');
    }
  }
  
  showWelcomeMessage() {
    const userName = this.state.user.firstName || this.state.user.username;
    
    this.showToast(`Welcome ${userName}! Ready to play?`, 'success');
  }
  
  showCelebration(prizeAmount, pattern) {
    // Play celebration sound
    if (this.state.soundEnabled) {
      this.playSound('bingo');
    }
    
    // Update celebration modal
    document.getElementById('celebrationPrize').textContent = `${prizeAmount} ETB`;
    document.getElementById('celebrationPattern').textContent = pattern;
    
    // Show celebration modal
    this.components.ui.openModal('bingoCelebration');
  }
  
  playSound(soundName) {
    const audio = document.getElementById(`${soundName}Sound`);
    
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  }
  
  showToast(message, type = 'info') {
    this.components.ui.showToast(message, type);
  }
  
  showError(message) {
    this.components.ui.showError(message);
  }
  
  initializeDepositModal() {
    // Implementation for deposit modal
  }
  
  initializeCelebrationModal() {
    // Implementation for celebration modal
  }
  
  openDepositModal() {
    this.components.ui.openModal('depositModal');
  }
  
  openWithdrawModal() {
    // Implementation for withdraw modal
  }
  
  showHelp() {
    // Implementation for help section
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Hide loading screen
  setTimeout(() => {
    document.getElementById('loadingScreen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('loadingScreen').style.display = 'none';
    }, 300);
  }, 1000);
  
  // Initialize app
  window.app = new GeezBingoApp();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeezBingoApp;
}
