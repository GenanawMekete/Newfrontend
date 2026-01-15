// ========================================
// GEEZ BINGO - GAME MANAGER
// Dynamic Timing System
// ========================================

class GameManager {
    constructor(socket, config) {
        this.socket = socket;
        this.config = config;
        
        // Game State
        this.currentGame = null;
        this.gamePhase = 'idle'; // idle, card_selection, countdown, active, announcing
        this.selectedCard = null;
        this.markedNumbers = new Set();
        this.calledNumbers = [];
        this.winners = [];
        
        // Timing & Intervals
        this.numberCallTimer = null;
        this.selectionTimer = null;
        this.countdownTimer = null;
        this.gameDurationTimer = null;
        this.nextCallTimer = null;
        
        // Settings
        this.settings = {
            autoMark: true,
            soundEnabled: true,
            vibrationEnabled: true,
            notifications: true
        };
        
        // Stats
        this.stats = {
            gamesPlayed: 0,
            gamesWon: 0,
            totalWinnings: 0,
            currentStreak: 0,
            bestStreak: 0
        };
        
        // UI References
        this.uiElements = {};
        
        this.initialize();
    }
    
    // ========== INITIALIZATION ==========
    
    initialize() {
        this.cacheUIElements();
        this.bindEventListeners();
        this.loadSettings();
        this.loadStats();
        this.setupSocketHandlers();
        this.initializeBingoCard();
        
        console.log('🎮 Game Manager initialized');
    }
    
    cacheUIElements() {
        this.uiElements = {
            // Game Status
            gameStatus: document.getElementById('gameStatus'),
            playerCount: document.getElementById('playerCount'),
            prizePool: document.getElementById('prizePool'),
            gameId: document.getElementById('gameId'),
            
            // Current Call
            currentCallLetter: document.getElementById('currentCallLetter'),
            currentCallNumber: document.getElementById('currentCallNumber'),
            callCounter: document.getElementById('callCounter'),
            nextCallTimer: document.getElementById('nextCallTimer'),
            
            // Bingo Card
            bingoCardBody: document.getElementById('bingoCardBody'),
            yourCardNumber: document.getElementById('yourCardNumber'),
            cardStatus: document.getElementById('cardStatus'),
            
            // Controls
            autoMarkToggle: document.getElementById('autoMarkToggle'),
            clearMarksBtn: document.getElementById('clearMarksBtn'),
            bingoClaimBtn: document.getElementById('bingoClaimBtn'),
            
            // Called Numbers
            calledNumbersGrid: document.getElementById('calledNumbersGrid'),
            calledCount: document.getElementById('calledCount'),
            lastCallTime: document.getElementById('lastCallTime'),
            
            // Phase Indicators
            phaseIndicators: document.querySelectorAll('.phase-indicator'),
            
            // Timers
            cardSelectionTimer: document.getElementById('cardSelectionTimer'),
            gameStartTimer: document.getElementById('gameStartTimer'),
            gameDuration: document.getElementById('gameDuration'),
            
            // Modals
            countdownDisplay: document.getElementById('countdownDisplay'),
            winnerAnnouncement: document.getElementById('winnerAnnouncement'),
            cardSelectionPanel: document.getElementById('cardSelectionPanel'),
            selectionTimer: document.getElementById('selectionTimer'),
            selectionProgress: document.getElementById('selectionProgress'),
            timeLeftMessage: document.getElementById('timeLeftMessage'),
            nextGameId: document.getElementById('nextGameId'),
            selectionEndsAt: document.getElementById('selectionEndsAt'),
            
            // Audio
            numberCallSound: document.getElementById('numberCallSound'),
            bingoSound: document.getElementById('bingoSound'),
            winSound: document.getElementById('winSound'),
            gameStartSound: document.getElementById('gameStartSound'),
            countdownSound: document.getElementById('countdownSound')
        };
    }
    
    bindEventListeners() {
        // Auto-mark toggle
        this.uiElements.autoMarkToggle.addEventListener('click', (e) => {
            this.toggleAutoMark(e.currentTarget);
        });
        
        // Clear marks
        this.uiElements.clearMarksBtn.addEventListener('click', () => {
            this.clearAllMarks();
        });
        
        // Claim Bingo
        this.uiElements.bingoClaimBtn.addEventListener('click', () => {
            this.claimBingo();
        });
        
        // Quick select card
        document.getElementById('quickSelectBtn')?.addEventListener('click', () => {
            this.quickSelectCard();
        });
        
        // Manual select card
        document.getElementById('manualSelectBtn')?.addEventListener('click', () => {
            this.openCardSelectionModal();
        });
        
        // Quick play
        document.getElementById('quickPlayBtn')?.addEventListener('click', () => {
            this.quickPlay();
        });
        
        // Window focus/blur for sound management
        window.addEventListener('focus', () => {
            this.settings.soundEnabled = true;
        });
        
        window.addEventListener('blur', () => {
            this.settings.soundEnabled = false;
        });
    }
    
    setupSocketHandlers() {
        // Game State
        this.socket.on('gameState', (data) => {
            this.handleGameState(data);
        });
        
        // Game Countdown
        this.socket.on('gameCountdown', (data) => {
            this.handleGameCountdown(data);
        });
        
        // Game Started
        this.socket.on('gameStarted', (data) => {
            this.handleGameStarted(data);
        });
        
        // Number Called (every 5 seconds)
        this.socket.on('numberCalled', (data) => {
            this.handleNumberCalled(data);
        });
        
        // Game Ended
        this.socket.on('gameEnded', (data) => {
            this.handleGameEnded(data);
        });
        
        // Winner Announcement (5 seconds)
        this.socket.on('winnerAnnouncement', (data) => {
            this.handleWinnerAnnouncement(data);
        });
        
        // Card Selection Started (30 seconds)
        this.socket.on('cardSelectionStarted', (data) => {
            this.handleCardSelectionStarted(data);
        });
        
        // Card Selection Updates
        this.socket.on('cardSelectionUpdate', (data) => {
            this.handleCardSelectionUpdate(data);
        });
        
        // Player Joined
        this.socket.on('playerJoined', (data) => {
            this.handlePlayerJoined(data);
        });
        
        // Bingo Claimed (by other players)
        this.socket.on('bingoClaimed', (data) => {
            this.handleBingoClaimed(data);
        });
        
        // Error handling
        this.socket.on('error', (data) => {
            this.showError(data.message);
        });
        
        // Disconnect/Reconnect
        this.socket.on('disconnect', () => {
            this.handleDisconnect();
        });
        
        this.socket.on('reconnect', () => {
            this.handleReconnect();
        });
    }
    
    // ========== GAME STATE HANDLERS ==========
    
    handleGameState(data) {
        this.gamePhase = data.phase;
        this.currentGame = data.activeGame;
        
        // Update UI based on phase
        this.updateGamePhaseUI(data.phase);
        
        // Update game info
        if (this.currentGame) {
            this.updateGameInfo(this.currentGame);
        }
        
        // Update called numbers if any
        if (this.currentGame?.drawnNumbers) {
            this.updateCalledNumbers(this.currentGame.drawnNumbers);
        }
    }
    
    handleGameCountdown(data) {
        this.gamePhase = 'countdown';
        
        // Update countdown display
        this.showCountdown(data.seconds, data.message);
        
        // Update phase indicator
        this.updatePhaseIndicator('countdown');
        
        // Play countdown sound on last 3 seconds
        if (data.seconds <= 3 && this.settings.soundEnabled) {
            this.playSound('countdown');
        }
    }
    
    handleGameStarted(data) {
        this.gamePhase = 'active';
        this.currentGame = data;
        
        // Clear previous marks
        this.clearAllMarks();
        
        // Update game info
        this.updateGameInfo(data);
        
        // Update phase indicator
        this.updatePhaseIndicator('active');
        
        // Start game duration timer
        this.startGameDurationTimer();
        
        // Play game start sound
        if (this.settings.soundEnabled) {
            this.playSound('gameStart');
        }
        
        // Show notification
        this.showNotification(`Game started! Prize pool: ${data.prizePool} ETB`, 'success');
    }
    
    handleNumberCalled(data) {
        // Add to called numbers
        this.calledNumbers.push({
            number: data.number,
            letter: data.letter,
            timestamp: new Date(),
            callNumber: data.callNumber
        });
        
        // Update current call display
        this.updateCurrentCall(data.number, data.letter, data.callNumber);
        
        // Add to called numbers grid
        this.addCalledNumber(data.number, data.letter);
        
        // Auto-mark on card if enabled
        if (this.settings.autoMark && this.selectedCard) {
            this.markNumberOnCard(data.number);
        }
        
        // Show number call animation
        this.showNumberCallAnimation(data.number, data.letter);
        
        // Play sound
        if (this.settings.soundEnabled) {
            this.playSound('numberCall');
        }
        
        // Start next call timer (5 seconds)
        this.startNextCallTimer();
        
        // Check for bingo
        this.checkForBingo();
    }
    
    handleGameEnded(data) {
        // Clear all timers
        this.clearAllTimers();
        
        this.gamePhase = 'announcing';
        this.winners = data.winners || [];
        
        // Update game info
        if (this.currentGame) {
            this.currentGame.endTime = data.endTime;
            this.currentGame.winners = this.winners;
        }
        
        // Update phase indicator
        this.updatePhaseIndicator('announcing');
        
        // Show game ended message
        if (this.winners.length > 0) {
            this.showNotification(`Game ended! ${this.winners.length} winner(s)`, 'info');
        } else {
            this.showNotification('Game ended. No winners!', 'info');
        }
        
        // Update stats if we won
        this.updatePlayerStats();
    }
    
    handleWinnerAnnouncement(data) {
        // Show winner announcement modal
        this.showWinnerAnnouncement(data.winners, data.duration);
        
        // If we're a winner, show celebration
        const currentUser = this.getCurrentUser();
        const userWon = data.winners.some(winner => winner.telegramId === currentUser?.id);
        
        if (userWon) {
            const userWin = data.winners.find(winner => winner.telegramId === currentUser?.id);
            this.showBingoCelebration(userWin);
        }
    }
    
    handleCardSelectionStarted(data) {
        this.gamePhase = 'card_selection';
        
        // Show card selection panel
        this.showCardSelectionPanel(data);
        
        // Update phase indicator
        this.updatePhaseIndicator('card_selection');
        
        // Start selection timer
        this.startSelectionTimer(data.duration, data.endsAt);
        
        // Store next game ID
        this.nextGameId = data.nextGameId;
    }
    
    handleCardSelectionUpdate(data) {
        // Update selection timer from server
        if (this.uiElements.selectionTimer) {
            this.uiElements.selectionTimer.textContent = `${data.secondsLeft}s`;
        }
        
        if (this.uiElements.selectionProgress) {
            this.uiElements.selectionProgress.style.width = `${data.progress}%`;
        }
    }
    
    handlePlayerJoined(data) {
        // Update player count
        if (this.uiElements.playerCount) {
            this.uiElements.playerCount.textContent = data.playerCount;
        }
        
        // Update prize pool
        if (this.uiElements.prizePool && data.totalPrizePool) {
            this.uiElements.prizePool.textContent = `${data.totalPrizePool} ETB`;
        }
        
        // Show notification for new players
        if (data.playerCount > 1) {
            this.showNotification(`New player joined! ${data.playerCount} players total`, 'info');
        }
    }
    
    handleBingoClaimed(data) {
        // Show notification when other players claim bingo
        if (data.userId !== this.getCurrentUser()?.id) {
            this.showNotification(`${data.username} claimed BINGO!`, 'warning');
        }
    }
    
    handleDisconnect() {
        this.showNotification('Disconnected from server. Reconnecting...', 'error');
        this.updateConnectionStatus(false);
    }
    
    handleReconnect() {
        this.showNotification('Reconnected to server!', 'success');
        this.updateConnectionStatus(true);
        
        // Request current game state
        this.socket.emit('getGameState');
    }
    
    // ========== GAME LOGIC ==========
    
    initializeBingoCard() {
        const tbody = this.uiElements.bingoCardBody;
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        // Generate 5x5 bingo card
        for (let row = 0; row < 5; row++) {
            const tr = document.createElement('tr');
            
            for (let col = 0; col < 5; col++) {
                const td = document.createElement('td');
                
                // Free space in the middle
                if (row === 2 && col === 2) {
                    td.textContent = 'FREE';
                    td.className = 'free';
                    td.dataset.free = 'true';
                } else {
                    // Generate random number for column range
                    const letter = ['B', 'I', 'N', 'G', 'O'][col];
                    const number = this.generateBingoNumber(letter);
                    
                    td.textContent = number;
                    td.dataset.number = number;
                    td.dataset.letter = letter;
                    td.dataset.row = row;
                    td.dataset.col = col;
                    
                    // Add click event for manual marking
                    td.addEventListener('click', () => {
                        this.toggleNumberMark(td);
                    });
                }
                
                tr.appendChild(td);
            }
            
            tbody.appendChild(tr);
        }
    }
    
    generateBingoCard(cardNumber) {
        // Generate deterministic card based on card number
        const card = [];
        const letters = ['B', 'I', 'N', 'G', 'O'];
        
        for (let col = 0; col < 5; col++) {
            const column = [];
            const letter = letters[col];
            
            // Generate 5 unique numbers for this column
            while (column.length < 5) {
                const number = this.generateBingoNumber(letter, cardNumber + col + column.length);
                if (!column.includes(number)) {
                    column.push(number);
                }
            }
            
            column.sort((a, b) => a - b);
            card.push(column);
        }
        
        return card;
    }
    
    generateBingoNumber(letter, seed = null) {
        const ranges = {
            'B': { min: 1, max: 15 },
            'I': { min: 16, max: 30 },
            'N': { min: 31, max: 45 },
            'G': { min: 46, max: 60 },
            'O': { min: 61, max: 75 }
        };
        
        const range = ranges[letter];
        if (!range) return 0;
        
        if (seed) {
            // Deterministic random based on seed
            const random = (seed * 9301 + 49297) % 233280;
            return Math.floor((random / 233280) * (range.max - range.min + 1)) + range.min;
        } else {
            // Random number
            return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
        }
    }
    
    markNumberOnCard(number) {
        const cell = this.uiElements.bingoCardBody.querySelector(`td[data-number="${number}"]`);
        if (cell && !cell.classList.contains('marked')) {
            cell.classList.add('marked');
            this.markedNumbers.add(number);
            
            // Check for bingo
            this.checkForBingo();
        }
    }
    
    toggleNumberMark(cell) {
        if (cell.dataset.free === 'true') return;
        
        const number = parseInt(cell.dataset.number);
        
        if (cell.classList.contains('marked')) {
            cell.classList.remove('marked');
            this.markedNumbers.delete(number);
        } else {
            cell.classList.add('marked');
            this.markedNumbers.add(number);
        }
        
        // Check for bingo
        this.checkForBingo();
    }
    
    checkForBingo() {
        if (!this.selectedCard || this.markedNumbers.size < 5) return;
        
        const card = this.getCardNumbers();
        const marked = Array.from(this.markedNumbers);
        
        // Check all bingo patterns
        const patterns = [
            this.checkHorizontalLines(card, marked),
            this.checkVerticalLines(card, marked),
            this.checkDiagonals(card, marked),
            this.checkFourCorners(card, marked),
            this.checkFullHouse(card, marked)
        ];
        
        const winningPattern = patterns.find(pattern => pattern !== null);
        
        if (winningPattern) {
            // Enable BINGO button
            this.uiElements.bingoClaimBtn.disabled = false;
            this.uiElements.bingoClaimBtn.classList.add('pulse');
            
            // Store winning pattern for claim
            this.winningPattern = winningPattern;
            
            // Play bingo sound (soft)
            if (this.settings.soundEnabled) {
                this.playSound('bingo', 0.5);
            }
        }
    }
    
    claimBingo() {
        if (!this.selectedCard || !this.winningPattern) return;
        
        // Disable button while processing
        this.uiElements.bingoClaimBtn.disabled = true;
        this.uiElements.bingoClaimBtn.classList.remove('pulse');
        
        // Send claim to server
        this.socket.emit('claimBingo', {
            gameId: this.currentGame?.gameId,
            cardNumber: this.selectedCard,
            winningPattern: this.winningPattern.pattern,
            winningNumbers: this.winningPattern.numbers
        });
        
        // Play bingo sound
        if (this.settings.soundEnabled) {
            this.playSound('bingo');
        }
        
        // Show claiming message
        this.showNotification('Claiming BINGO...', 'info');
    }
    
    // ========== TIMING & TIMERS ==========
    
    startNextCallTimer() {
        // Clear previous timer
        if (this.nextCallTimer) {
            clearTimeout(this.nextCallTimer);
        }
        
        let seconds = 5;
        
        // Update timer display
        const updateTimer = () => {
            if (this.uiElements.nextCallTimer) {
                this.uiElements.nextCallTimer.textContent = `${seconds}s`;
                
                if (seconds <= 0) {
                    this.uiElements.nextCallTimer.textContent = 'Calling...';
                }
            }
            
            seconds--;
            
            if (seconds >= 0) {
                this.nextCallTimer = setTimeout(updateTimer, 1000);
            }
        };
        
        updateTimer();
    }
    
    startSelectionTimer(duration, endsAt) {
        // Clear previous timer
        if (this.selectionTimer) {
            clearInterval(this.selectionTimer);
        }
        
        const endTime = new Date(endsAt);
        let timeLeft = Math.floor((endTime - new Date()) / 1000);
        
        // Update timer immediately
        this.updateSelectionTimer(timeLeft, duration);
        
        // Start countdown
        this.selectionTimer = setInterval(() => {
            timeLeft--;
            
            if (timeLeft <= 0) {
                clearInterval(this.selectionTimer);
                this.hideCardSelectionPanel();
                return;
            }
            
            this.updateSelectionTimer(timeLeft, duration);
        }, 1000);
    }
    
    startGameDurationTimer() {
        // Clear previous timer
        if (this.gameDurationTimer) {
            clearInterval(this.gameDurationTimer);
        }
        
        let seconds = 0;
        
        this.gameDurationTimer = setInterval(() => {
            seconds++;
            
            if (this.uiElements.gameDuration) {
                this.uiElements.gameDuration.textContent = `${seconds}s`;
            }
        }, 1000);
    }
    
    clearAllTimers() {
        if (this.numberCallTimer) clearTimeout(this.numberCallTimer);
        if (this.selectionTimer) clearInterval(this.selectionTimer);
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        if (this.gameDurationTimer) clearInterval(this.gameDurationTimer);
        if (this.nextCallTimer) clearTimeout(this.nextCallTimer);
    }
    
    // ========== UI UPDATES ==========
    
    updateGamePhaseUI(phase) {
        this.gamePhase = phase;
        
        // Update status text
        if (this.uiElements.gameStatus) {
            this.uiElements.gameStatus.textContent = phase.toUpperCase();
            this.uiElements.gameStatus.className = `status-value ${phase}`;
        }
        
        // Update phase indicators
        this.updatePhaseIndicator(phase);
        
        // Show/hide appropriate UI elements
        switch(phase) {
            case 'idle':
            case 'waiting':
                this.hideCardSelectionPanel();
                this.hideCountdown();
                break;
                
            case 'card_selection':
                this.showCardSelectionPanel();
                this.hideCountdown();
                break;
                
            case 'countdown':
                this.hideCardSelectionPanel();
                break;
                
            case 'active':
                this.hideCardSelectionPanel();
                this.hideCountdown();
                break;
                
            case 'announcing':
                this.hideCardSelectionPanel();
                this.hideCountdown();
                break;
        }
    }
    
    updatePhaseIndicator(phase) {
        // Remove active class from all indicators
        this.uiElements.phaseIndicators?.forEach(indicator => {
            indicator.classList.remove('active');
        });
        
        // Add active class to current phase
        const currentIndicator = document.querySelector(`.phase-indicator[data-phase="${phase}"]`);
        if (currentIndicator) {
            currentIndicator.classList.add('active');
        }
    }
    
    updateGameInfo(game) {
        if (this.uiElements.playerCount) {
            this.uiElements.playerCount.textContent = game.playerCount || 0;
        }
        
        if (this.uiElements.prizePool) {
            this.uiElements.prizePool.textContent = `${game.prizePool || 0} ETB`;
        }
        
        if (this.uiElements.gameId) {
            this.uiElements.gameId.textContent = game.gameId || '-';
        }
    }
    
    updateCurrentCall(number, letter, callNumber) {
        if (this.uiElements.currentCallLetter) {
            this.uiElements.currentCallLetter.textContent = letter;
        }
        
        if (this.uiElements.currentCallNumber) {
            this.uiElements.currentCallNumber.textContent = number;
        }
        
        if (this.uiElements.callCounter) {
            this.uiElements.callCounter.textContent = `Call #${callNumber}`;
        }
        
        // Update last call time
        if (this.uiElements.lastCallTime) {
            const now = new Date();
            this.uiElements.lastCallTime.textContent = now.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }
    
    updateCalledNumbers(numbers) {
        if (!this.uiElements.calledNumbersGrid) return;
        
        // Clear grid
        this.uiElements.calledNumbersGrid.innerHTML = '';
        
        // Add called numbers (most recent first)
        numbers.slice().reverse().forEach(number => {
            const bubble = document.createElement('div');
            bubble.className = 'number-bubble';
            bubble.textContent = number;
            this.uiElements.calledNumbersGrid.appendChild(bubble);
        });
        
        // Update count
        if (this.uiElements.calledCount) {
            this.uiElements.calledCount.textContent = numbers.length;
        }
    }
    
    addCalledNumber(number, letter) {
        if (!this.uiElements.calledNumbersGrid) return;
        
        // Create number bubble
        const bubble = document.createElement('div');
        bubble.className = 'number-bubble recent';
        bubble.textContent = number;
        bubble.title = `${letter}-${number}`;
        
        // Add to beginning of grid
        this.uiElements.calledNumbersGrid.insertBefore(bubble, this.uiElements.calledNumbersGrid.firstChild);
        
        // Remove "recent" class after animation
        setTimeout(() => {
            bubble.classList.remove('recent');
        }, 2000);
        
        // Limit to 50 numbers shown
        if (this.uiElements.calledNumbersGrid.children.length > 50) {
            this.uiElements.calledNumbersGrid.removeChild(this.uiElements.calledNumbersGrid.lastChild);
        }
        
        // Update count
        if (this.uiElements.calledCount) {
            const currentCount = parseInt(this.uiElements.calledCount.textContent) || 0;
            this.uiElements.calledCount.textContent = currentCount + 1;
        }
    }
    
    updateSelectionTimer(timeLeft, totalDuration) {
        if (this.uiElements.selectionTimer) {
            this.uiElements.selectionTimer.textContent = `${timeLeft}s`;
        }
        
        if (this.uiElements.selectionProgress) {
            const progress = ((totalDuration - timeLeft) / totalDuration) * 100;
            this.uiElements.selectionProgress.style.width = `${progress}%`;
        }
        
        if (this.uiElements.timeLeftMessage) {
            this.uiElements.timeLeftMessage.textContent = 
                `${timeLeft} seconds to select your card`;
        }
    }
    
    // ========== UI SHOW/HIDE ==========
    
    showCountdown(seconds, message) {
        if (!this.uiElements.countdownDisplay) return;
        
        const content = `
            <div class="countdown-box">
                <div class="countdown-number">${seconds}</div>
                <div class="countdown-label">${message}</div>
            </div>
        `;
        
        this.uiElements.countdownDisplay.innerHTML = content;
        this.uiElements.countdownDisplay.style.display = 'block';
        
        // Auto-hide when countdown reaches 0
        if (seconds <= 0) {
            setTimeout(() => {
                this.hideCountdown();
            }, 1000);
        }
    }
    
    hideCountdown() {
        if (this.uiElements.countdownDisplay) {
            this.uiElements.countdownDisplay.style.display = 'none';
        }
    }
    
    showNumberCallAnimation(number, letter) {
        const container = document.getElementById('numberCallAnimation');
        if (!container) return;
        
        const animation = `
            <div class="number-call-animation">
                <div class="call-letter">${letter}</div>
                <div class="call-number">${number}</div>
                <div class="call-label">Called!</div>
            </div>
        `;
        
        container.innerHTML = animation;
        container.style.display = 'block';
        
        // Hide after animation
        setTimeout(() => {
            container.style.display = 'none';
        }, 2000);
    }
    
    showWinnerAnnouncement(winners, duration) {
        const container = this.uiElements.winnerAnnouncement;
        if (!container) return;
        
        let content = '';
        
        if (winners.length === 0) {
            content = `
                <div class="announcement-content no-winner">
                    <h3>🏁 Game Over!</h3>
                    <p>No winners this round. Better luck next time!</p>
                    <div class="announcement-timer">Next game in ${duration}s</div>
                </div>
            `;
        } else {
            content = `
                <div class="announcement-content">
                    <h3>🎉 BINGO WINNERS! 🎉</h3>
                    ${winners.map(winner => `
                        <div class="winner-card">
                            <div class="winner-header">
                                <span class="winner-name">${winner.username}</span>
                                <span class="winner-prize">${winner.prizeAmount} ETB</span>
                            </div>
                            <div class="winner-details">
                                <span class="detail-item">
                                    <i class="fas fa-id-card"></i> Card #${winner.cardNumber}
                                </span>
                                <span class="detail-item">
                                    <i class="fas fa-shapes"></i> ${this.formatPattern(winner.winningPattern)}
                                </span>
                            </div>
                            ${winner.winningNumbers ? `
                                <div class="winning-numbers">
                                    ${winner.winningNumbers.map(n => `<span class="winning-number">${n}</span>`).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                    <div class="announcement-timer">Next game in ${duration}s</div>
                </div>
            `;
        }
        
        container.innerHTML = content;
        container.style.display = 'block';
        
        // Auto-hide after duration
        setTimeout(() => {
            container.style.display = 'none';
        }, duration * 1000);
    }
    
    showBingoCelebration(winData) {
        const container = document.getElementById('bingoCelebration');
        if (!container) return;
        
        // Update celebration content
        document.getElementById('celebrationPrize').textContent = `${winData.prizeAmount} ETB`;
        document.getElementById('celebrationCardNumber').textContent = winData.cardNumber;
        document.getElementById('celebrationPattern').textContent = this.formatPattern(winData.winningPattern);
        
        // Update winning numbers
        const numbersContainer = document.getElementById('celebrationNumbers');
        if (numbersContainer && winData.winningNumbers) {
            numbersContainer.innerHTML = winData.winningNumbers.map(n => 
                `<span class="celebration-number">${n}</span>`
            ).join('');
        }
        
        // Show celebration
        container.style.display = 'flex';
        
        // Play win sound
        if (this.settings.soundEnabled) {
            this.playSound('win');
        }
        
        // Update stats
        this.updateStatsAfterWin(winData.prizeAmount);
    }
    
    showCardSelectionPanel(data = null) {
        const panel = this.uiElements.cardSelectionPanel;
        if (!panel) return;
        
        if (data) {
            // Update panel with data
            if (this.uiElements.nextGameId) {
                this.uiElements.nextGameId.textContent = data.nextGameId || '-';
            }
            
            if (this.uiElements.selectionEndsAt) {
                const endsAt = new Date(data.endsAt);
                this.uiElements.selectionEndsAt.textContent = 
                    endsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }
        
        panel.style.display = 'block';
    }
    
    hideCardSelectionPanel() {
        if (this.uiElements.cardSelectionPanel) {
            this.uiElements.cardSelectionPanel.style.display = 'none';
        }
    }
    
    // ========== UTILITY METHODS ==========
    
    formatPattern(pattern) {
        const patternMap = {
            'horizontal-line-1': 'Top Line',
            'horizontal-line-2': 'Second Line',
            'horizontal-line-3': 'Third Line',
            'horizontal-line-4': 'Fourth Line',
            'horizontal-line-5': 'Bottom Line',
            'vertical-line-B': 'B Column',
            'vertical-line-I': 'I Column',
            'vertical-line-N': 'N Column',
            'vertical-line-G': 'G Column',
            'vertical-line-O': 'O Column',
            'diagonal-main': 'Diagonal ↘️',
            'diagonal-anti': 'Diagonal ↙️',
            'four-corners': 'Four Corners',
            'full-house': 'Full House'
        };
        
        return patternMap[pattern] || pattern;
    }
    
    playSound(soundName, volume = 1.0) {
        if (!this.settings.soundEnabled) return;
        
        const audio = this.uiElements[`${soundName}Sound`];
        if (audio) {
            audio.volume = volume;
            audio.currentTime = 0;
            audio.play().catch(e => {
                console.log('Audio play failed:', e);
                // Suppress error in production
            });
        }
    }
    
    showNotification(message, type = 'info') {
        // Implementation in ui.js
        if (window.ui) {
            window.ui.showToast(message, type);
        }
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    updateConnectionStatus(connected) {
        const icon = document.getElementById('connectionIcon');
        const status = document.getElementById('connectionStatus');
        
        if (icon && status) {
            if (connected) {
                icon.className = 'fas fa-wifi';
                icon.style.color = '#4CAF50';
                status.textContent = 'Connected';
            } else {
                icon.className = 'fas fa-wifi-slash';
                icon.style.color = '#f44336';
                status.textContent = 'Disconnected';
            }
        }
    }
    
    getCardNumbers() {
        const card = [];
        const cells = this.uiElements.bingoCardBody.querySelectorAll('td[data-number]');
        
        cells.forEach(cell => {
            const col = parseInt(cell.dataset.col);
            const row = parseInt(cell.dataset.row);
            const number = parseInt(cell.dataset.number);
            
            if (!card[col]) card[col] = [];
            card[col][row] = number;
        });
        
        return card;
    }
    
    clearAllMarks() {
        // Clear marked numbers set
        this.markedNumbers.clear();
        
        // Remove marked class from all cells
        const markedCells = this.uiElements.bingoCardBody.querySelectorAll('.marked');
        markedCells.forEach(cell => {
            cell.classList.remove('marked');
        });
        
        // Disable BINGO button
        this.uiElements.bingoClaimBtn.disabled = true;
        this.uiElements.bingoClaimBtn.classList.remove('pulse');
        
        // Clear winning pattern
        this.winningPattern = null;
    }
    
    toggleAutoMark(button) {
        this.settings.autoMark = !this.settings.autoMark;
        
        if (this.settings.autoMark) {
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-robot"></i> Auto-mark ON';
        } else {
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-robot"></i> Auto-mark OFF';
        }
    }
    
    getCurrentUser() {
        // Get from Telegram Web App or localStorage
        if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
            return Telegram.WebApp.initDataUnsafe.user;
        }
        
        // Fallback for testing
        return {
            id: localStorage.getItem('bingo_user_id') || 'demo_user',
            username: 'Demo User',
            firstName: 'Demo'
        };
    }
    
    // ========== BINGO PATTERN CHECKING ==========
    
    checkHorizontalLines(card, markedNumbers) {
        for (let row = 0; row < 5; row++) {
            let complete = true;
            const numbers = [];
            
            for (let col = 0; col < 5; col++) {
                if (row === 2 && col === 2) continue; // Free space
                
                const num = card[col][row];
                numbers.push(num);
                
                if (!markedNumbers.includes(num)) {
                    complete = false;
                }
            }
            
            if (complete) {
                return {
                    pattern: `horizontal-line-${row + 1}`,
                    numbers: numbers
                };
            }
        }
        return null;
    }
    
    checkVerticalLines(card, markedNumbers) {
        const letters = ['B', 'I', 'N', 'G', 'O'];
        
        for (let col = 0; col < 5; col++) {
            let complete = true;
            const numbers = [];
            
            for (let row = 0; row < 5; row++) {
                if (row === 2 && col === 2) continue; // Free space
                
                const num = card[col][row];
                numbers.push(num);
                
                if (!markedNumbers.includes(num)) {
                    complete = false;
                }
            }
            
            if (complete) {
                return {
                    pattern: `vertical-line-${letters[col]}`,
                    numbers: numbers
                };
            }
        }
        return null;
    }
    
    checkDiagonals(card, markedNumbers) {
        // Main diagonal
        let mainComplete = true;
        const mainNumbers = [];
        
        for (let i = 0; i < 5; i++) {
            if (i === 2) continue; // Free space
            
            const num = card[i][i];
            mainNumbers.push(num);
            
            if (!markedNumbers.includes(num)) {
                mainComplete = false;
            }
        }
        
        if (mainComplete) {
            return {
                pattern: 'diagonal-main',
                numbers: mainNumbers
            };
        }
        
        // Anti-diagonal
        let antiComplete = true;
        const antiNumbers = [];
        
        for (let i = 0; i < 5; i++) {
            if (i === 2) continue; // Free space
            
            const num = card[4 - i][i];
            antiNumbers.push(num);
            
            if (!markedNumbers.includes(num)) {
                antiComplete = false;
            }
        }
        
        if (antiComplete) {
            return {
                pattern: 'diagonal-anti',
                numbers: antiNumbers
            };
        }
        
        return null;
    }
    
    checkFourCorners(card, markedNumbers) {
        const corners = [
            card[0][0], // Top-left
            card[4][0], // Top-right
            card[0][4], // Bottom-left
            card[4][4]  // Bottom-right
        ];
        
        const allMarked = corners.every(corner => markedNumbers.includes(corner));
        
        if (allMarked) {
            return {
                pattern: 'four-corners',
                numbers: corners
            };
        }
        
        return null;
    }
    
    checkFullHouse(card, markedNumbers) {
        for (let col = 0; col < 5; col++) {
            for (let row = 0; row < 5; row++) {
                if (row === 2 && col === 2) continue; // Free space
                
                const num = card[col][row];
                if (!markedNumbers.includes(num)) {
                    return null;
                }
            }
        }
        
        // All numbers marked (full house)
        return {
            pattern: 'full-house',
            numbers: markedNumbers
        };
    }
    
    // ========== STATS & SETTINGS ==========
    
    loadSettings() {
        const saved = localStorage.getItem('bingo_settings');
        if (saved) {
            this.settings = { ...this.settings, ...JSON.parse(saved) };
        }
        
        // Apply settings to UI
        if (this.settings.autoMark) {
            this.uiElements.autoMarkToggle.classList.add('active');
            this.uiElements.autoMarkToggle.innerHTML = '<i class="fas fa-robot"></i> Auto-mark ON';
        }
    }
    
    saveSettings() {
        localStorage.setItem('bingo_settings', JSON.stringify(this.settings));
    }
    
    loadStats() {
        const saved = localStorage.getItem('bingo_stats');
        if (saved) {
            this.stats = JSON.parse(saved);
        }
        
        this.updateStatsDisplay();
    }
    
    saveStats() {
        localStorage.setItem('bingo_stats', JSON.stringify(this.stats));
    }
    
    updateStatsDisplay() {
        // Update stats in UI
        document.getElementById('gamesPlayed').textContent = this.stats.gamesPlayed;
        document.getElementById('gamesWon').textContent = this.stats.gamesWon;
        document.getElementById('totalWinnings').textContent = `${this.stats.totalWinnings} ETB`;
        
        // Calculate win rate
        const winRate = this.stats.gamesPlayed > 0 
            ? Math.round((this.stats.gamesWon / this.stats.gamesPlayed) * 100)
            : 0;
        document.getElementById('winRate').textContent = `${winRate}%`;
    }
    
    updatePlayerStats() {
        // This would be called when game ends
        this.stats.gamesPlayed++;
        
        // Check if current user won
        const currentUser = this.getCurrentUser();
        const userWon = this.winners.some(winner => winner.userId === currentUser?.id);
        
        if (userWon) {
            this.stats.gamesWon++;
            this.stats.currentStreak++;
            
            if (this.stats.currentStreak > this.stats.bestStreak) {
                this.stats.bestStreak = this.stats.currentStreak;
            }
            
            // Add winnings
            const userWin = this.winners.find(winner => winner.userId === currentUser?.id);
            if (userWin?.prizeAmount) {
                this.stats.totalWinnings += userWin.prizeAmount;
            }
        } else {
            this.stats.currentStreak = 0;
        }
        
        this.saveStats();
        this.updateStatsDisplay();
    }
    
    updateStatsAfterWin(prizeAmount) {
        this.stats.gamesWon++;
        this.stats.gamesPlayed++;
        this.stats.totalWinnings += prizeAmount;
        this.stats.currentStreak++;
        
        if (this.stats.currentStreak > this.stats.bestStreak) {
            this.stats.bestStreak = this.stats.currentStreak;
        }
        
        this.saveStats();
        this.updateStatsDisplay();
    }
    
    // ========== CARD SELECTION ==========
    
    quickSelectCard() {
        // Select a random available card
        this.selectRandomCard();
    }
    
    openCardSelectionModal() {
        // Open card selection modal
        if (window.ui) {
            window.ui.openModal('cardSelectionModal');
        }
    }
    
    selectRandomCard() {
        // For demo, select random card 1-400
        const cardNumber = Math.floor(Math.random() * 400) + 1;
        this.selectCard(cardNumber);
    }
    
    selectCard(cardNumber) {
        this.selectedCard = cardNumber;
        
        // Update UI
        if (this.uiElements.yourCardNumber) {
            this.uiElements.yourCardNumber.textContent = cardNumber;
        }
        
        if (this.uiElements.cardStatus) {
            this.uiElements.cardStatus.textContent = 'Selected';
            this.uiElements.cardStatus.className = 'card-status selected';
        }
        
        // Generate card numbers
        const card = this.generateBingoCard(cardNumber);
        this.updateCardNumbers(card);
        
        // Notify server
        this.socket.emit('selectCard', {
            cardNumber: cardNumber,
            gameId: this.currentGame?.gameId || this.nextGameId
        });
        
        // Show notification
        this.showNotification(`Card #${cardNumber} selected!`, 'success');
    }
    
    updateCardNumbers(card) {
        const cells = this.uiElements.bingoCardBody.querySelectorAll('td[data-number]');
        
        cells.forEach(cell => {
            const col = parseInt(cell.dataset.col);
            const row = parseInt(cell.dataset.row);
            
            if (row === 2 && col === 2) return; // Skip free space
            
            const number = card[col][row];
            cell.textContent = number;
            cell.dataset.number = number;
        });
    }
    
    quickPlay() {
        if (!this.selectedCard) {
            this.quickSelectCard();
        }
        
        // Join game if not already joined
        if (!this.currentGame) {
            this.joinGame();
        }
    }
    
    joinGame() {
        this.socket.emit('joinGame', {
            betAmount: 10 // Default bet
        });
    }
}

// Export for global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameManager;
} else {
    // Browser global
    window.GameManager = GameManager;
}
