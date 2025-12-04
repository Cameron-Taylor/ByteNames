class BytenamesGame {
    constructor() {
        this.socket = null;
        this.currentGame = null;
        this.playerName = '';
        this.playerRole = '';
        this.roomId = '';
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // Screens
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.gameScreen = document.getElementById('game-screen');
        
        // Welcome form elements
        this.playerNameInput = document.getElementById('player-name');
        this.roomIdInput = document.getElementById('room-id');
        this.playerTeamSelect = document.getElementById('player-team');
        this.joinGameBtn = document.getElementById('join-game');
        
        // Game elements
        this.startGameBtn = document.getElementById('start-game');
        this.endTurnBtn = document.getElementById('end-turn');
        this.leaveGameBtn = document.getElementById('leave-game');
        
        console.log('End turn button found:', this.endTurnBtn);
        this.currentRoomSpan = document.getElementById('current-room');
        this.playerNameDisplay = document.getElementById('player-name-display');
        this.playerRoleDisplay = document.getElementById('player-role-display');
        
        // Game status elements
        this.redScoreSpan = document.getElementById('red-score');
        this.blueScoreSpan = document.getElementById('blue-score');
        this.redRemainingSpan = document.getElementById('red-remaining');
        this.blueRemainingSpan = document.getElementById('blue-remaining');
        this.currentTeamSpan = document.getElementById('current-team');
        this.clueDisplay = document.getElementById('clue-display');
        
        // Game board
        this.wordGrid = document.getElementById('word-grid');
        this.gameMessages = document.getElementById('game-messages');
        
        // Loading and modals
        this.loadingOverlay = document.getElementById('loading-overlay');
        this.gameOverModal = document.getElementById('game-over-modal');
        this.gameOverTitle = document.getElementById('game-over-title');
        this.gameOverMessage = document.getElementById('game-over-message');
        this.playAgainBtn = document.getElementById('play-again');
        this.newRoomBtn = document.getElementById('new-room');
    }

    bindEvents() {
        // Welcome screen events
        console.log('Binding events...');
        console.log('Join game button:', this.joinGameBtn);
        
        if (this.joinGameBtn) {
            this.joinGameBtn.addEventListener('click', () => {
                console.log('Join game button clicked!');
                this.joinGame();
            });
        } else {
            console.error('Join game button not found!');
        }
        
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        
        // Game screen events
        this.startGameBtn.addEventListener('click', () => this.startGame());
        this.endTurnBtn.addEventListener('click', () => this.endTurn());
        this.leaveGameBtn.addEventListener('click', () => this.leaveGame());
        this.playAgainBtn.addEventListener('click', () => this.playAgain());
        this.newRoomBtn.addEventListener('click', () => this.newRoom());
    }

    joinGame() {
        console.log('joinGame() called');
        const playerName = this.playerNameInput.value.trim();
        const roomId = this.roomIdInput.value.trim();
        const playerTeam = this.playerTeamSelect.value;

        console.log('Join game data:', { playerName, roomId, playerTeam });

        if (!playerName || !roomId) {
            console.log('Missing name or room ID');
            this.showMessage('Please enter both your name and room ID', 'error');
            return;
        }

        this.playerName = playerName;
        this.roomId = roomId;
        this.playerRole = 'operative'; // Default to operative
        this.playerTeam = playerTeam;

        this.showLoading(true);
        this.connectToGame();
    }

    connectToGame() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.socket.emit('join-room', {
                roomId: this.roomId,
                playerName: this.playerName,
                role: this.playerRole,
                team: this.playerTeam
            });
        });

        this.socket.on('game-state', (gameState) => {
            this.currentGame = gameState;
            // Convert revealedWords back to a Set if it's not already
            if (this.currentGame.revealedWords && !(this.currentGame.revealedWords instanceof Set)) {
                this.currentGame.revealedWords = new Set(this.currentGame.revealedWords);
            }
            // Store clue history
            this.currentGame.clueHistory = gameState.clueHistory || [];
            this.showLoading(false);
            this.showGameScreen();
            this.updateGameDisplay();
        });

        this.socket.on('player-joined', (data) => {
            this.addMessage(`${data.playerName} joined as ${data.role}`, 'info');
        });

        this.socket.on('game-started', (data) => {
            this.addMessage('Game started! AI spymaster has provided a clue.', 'success');
            this.currentGame.currentClue = data.clue;
            this.currentGame.guessesRemaining = data.guessesRemaining;
            // Update clue history if provided
            if (data.clueHistory) {
                this.currentGame.clueHistory = data.clueHistory;
                console.log('Updated clue history from game-started:', data.clueHistory);
            }
            console.log('Game started with clue:', data.clue);
            this.updateGameDisplay();
        });

        this.socket.on('guess-result', (data) => {
            this.handleGuessResult(data);
        });

        this.socket.on('new-clue', (data) => {
            this.addMessage(`New clue from AI spymaster: "${data.clue.clue}" for ${data.clue.number} words`, 'info');
            this.currentGame.currentClue = data.clue;
            this.currentGame.currentTeam = data.currentTeam;
            this.currentGame.guessesRemaining = data.guessesRemaining;
            // Update clue history if provided
            if (data.clueHistory) {
                this.currentGame.clueHistory = data.clueHistory;
                console.log('Updated clue history from new-clue:', data.clueHistory);
            }
            console.log('New clue received:', data.clue);
            this.updateGameDisplay();
        });

        this.socket.on('turn-ended', (data) => {
            this.addMessage(`Turn ended. ${data.currentTeam} team's turn with clue: "${data.clue.clue}" for ${data.clue.number} words`, 'info');
            this.currentGame.currentTeam = data.currentTeam;
            this.currentGame.currentClue = data.clue;
            this.currentGame.guessesRemaining = data.guessesRemaining;
            // Update clue history if provided
            if (data.clueHistory) {
                this.currentGame.clueHistory = data.clueHistory;
                console.log('Updated clue history from turn-ended:', data.clueHistory);
            }
            console.log('Turn ended with clue:', data.clue);
            this.updateGameDisplay();
        });

        this.socket.on('game-reset', (data) => {
            this.addMessage('New game started! Fresh words and board.', 'success');
            this.currentGame.words = data.words;
            this.currentGame.agentCards = data.agentCards;
            this.currentGame.currentTeam = data.currentTeam;
            this.currentGame.gamePhase = data.gamePhase;
            this.currentGame.redScore = data.redScore;
            this.currentGame.blueScore = data.blueScore;
            this.currentGame.redRemaining = data.redRemaining;
            this.currentGame.blueRemaining = data.blueRemaining;
            this.currentGame.revealedWords = new Set();
            this.currentGame.currentClue = null;
            this.currentGame.guessesRemaining = 0;
            this.currentGame.clueHistory = []; // Reset clue history
            this.updateGameDisplay();
            
            // Hide clue history and card reveal panels
            const clueHistoryPanel = document.getElementById('clue-history-panel');
            const cardRevealDisplay = document.getElementById('card-reveal-display');
            
            if (clueHistoryPanel) {
                clueHistoryPanel.style.display = 'none';
            }
            if (cardRevealDisplay) {
                cardRevealDisplay.style.display = 'none';
            }
            
            // Reset start game button
            if (this.startGameBtn) {
                this.startGameBtn.textContent = 'Start Game';
                this.startGameBtn.onclick = () => this.startGame();
            }
        });

        this.socket.on('guess-error', (data) => {
            this.addMessage(data.message, 'error');
        });

        this.socket.on('disconnect', () => {
            this.addMessage('Disconnected from server', 'error');
        });
    }

    showGameScreen() {
        this.welcomeScreen.classList.remove('active');
        this.gameScreen.classList.add('active');
        this.currentRoomSpan.textContent = this.roomId;
        this.playerNameDisplay.textContent = this.playerName;
        this.playerRoleDisplay.textContent = this.playerRole;
        
        // Enable the Start Game button
        if (this.startGameBtn) {
            this.startGameBtn.disabled = false;
            this.startGameBtn.textContent = 'Start Game';
        }
        
        // Enable the End Turn button
        if (this.endTurnBtn) {
            this.endTurnBtn.disabled = false;
            console.log('End turn button enabled');
        } else {
            console.error('End turn button not found!');
        }
    }

    updateGameDisplay() {
        if (!this.currentGame) return;
        
        // Ensure revealedWords is a Set
        if (this.currentGame.revealedWords && !(this.currentGame.revealedWords instanceof Set)) {
            this.currentGame.revealedWords = new Set(this.currentGame.revealedWords);
        }

        // Update scores
        if (this.redScoreSpan) this.redScoreSpan.textContent = this.currentGame.redScore || 0;
        if (this.blueScoreSpan) this.blueScoreSpan.textContent = this.currentGame.blueScore || 0;
        if (this.redRemainingSpan) this.redRemainingSpan.textContent = `${this.currentGame.redRemaining || 0} remaining`;
        if (this.blueRemainingSpan) this.blueRemainingSpan.textContent = `${this.currentGame.blueRemaining || 0} remaining`;

        // Update current team
        if (this.currentTeamSpan) {
            const teamName = this.currentGame.currentTeam === 'red' ? 'RED' : 'BLUE';
            this.currentTeamSpan.textContent = `${teamName}'s Turn`;
        }

        // Update clue display
        console.log('Clue display element:', this.clueDisplay);
        console.log('Current clue:', this.currentGame.currentClue);
        if (this.clueDisplay && this.currentGame.currentClue) {
            const clueText = this.clueDisplay.querySelector('.clue-text');
            console.log('Clue text element:', clueText);
            if (clueText) {
                const clueMessage = `Clue: "${this.currentGame.currentClue.clue}" for ${this.currentGame.currentClue.number} words (${this.currentGame.guessesRemaining} guesses remaining)`;
                clueText.textContent = clueMessage;
                console.log('Updated clue text:', clueMessage);
            }
        }

        // Update word grid
        this.updateWordGrid();
    }

    updateWordGrid() {
        if (!this.currentGame || !this.wordGrid) return;

        this.wordGrid.innerHTML = '';
        
        this.currentGame.words.forEach((word, index) => {
            const wordCard = document.createElement('div');
            wordCard.className = 'word-card';
            wordCard.textContent = word;
            wordCard.dataset.index = index;

            if (this.currentGame.revealedWords && this.currentGame.revealedWords.has(index)) {
                wordCard.classList.add('revealed');
                const cardType = this.getCardType(index);
                console.log(`Adding revealed card ${index} with type:`, cardType);
                wordCard.classList.add(cardType);
                
                // Add team indicator badge for revealed cards
                this.addTeamBadge(wordCard, cardType);
            } else {
                wordCard.classList.add('unrevealed');
                wordCard.addEventListener('click', () => this.makeGuess(index));
            }

            this.wordGrid.appendChild(wordCard);
        });
    }

    getCardType(index) {
        if (!this.currentGame || !this.currentGame.agentCards) {
            console.log('No currentGame or agentCards');
            return 'neutral';
        }
        
        const cardType = this.currentGame.agentCards[index];
        console.log(`Card ${index} type:`, cardType, 'from agentCards:', this.currentGame.agentCards);
        return cardType || 'neutral';
    }

    addTeamBadge(wordCard, cardType) {
        // Add clear team indicator with better styling
        if (cardType === 'red' || cardType === 'blue') {
            const teamBadge = document.createElement('div');
            teamBadge.className = 'team-badge';
            teamBadge.textContent = cardType === 'red' ? 'RED' : 'BLUE';
            teamBadge.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: ${cardType === 'red' ? '#e53e3e' : '#3182ce'};
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                z-index: 10;
            `;
            wordCard.style.position = 'relative';
            wordCard.appendChild(teamBadge);
        } else if (cardType === 'neutral') {
            const neutralBadge = document.createElement('div');
            neutralBadge.className = 'neutral-badge';
            neutralBadge.textContent = 'NEUTRAL';
            neutralBadge.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: #a0aec0;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                z-index: 10;
            `;
            wordCard.style.position = 'relative';
            wordCard.appendChild(neutralBadge);
        } else if (cardType === 'assassin') {
            const assassinBadge = document.createElement('div');
            assassinBadge.className = 'assassin-badge';
            assassinBadge.textContent = 'ASSASSIN';
            assassinBadge.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: #2d3748;
                color: #e53e3e;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                z-index: 10;
                border: 2px solid #e53e3e;
            `;
            wordCard.style.position = 'relative';
            wordCard.appendChild(assassinBadge);
        }
    }

    makeGuess(index) {
        if (!this.socket || !this.currentGame) return;

        this.socket.emit('make-guess', {
            roomId: this.roomId,
            wordIndex: index
        });
    }

    handleGuessResult(data) {
        // Ensure revealedWords is a Set
        if (this.currentGame.revealedWords && !(this.currentGame.revealedWords instanceof Set)) {
            this.currentGame.revealedWords = new Set(this.currentGame.revealedWords);
        }
        
        const wordCard = this.wordGrid.querySelector(`[data-index="${data.wordIndex}"]`);
        if (wordCard) {
            wordCard.classList.remove('unrevealed');
            wordCard.classList.add('revealed', data.cardType);
            console.log('Card revealed:', data.cardType, 'Classes:', wordCard.className);
            
            // Add clear team indicator with better styling
            if (data.cardType === 'red' || data.cardType === 'blue') {
                const teamBadge = document.createElement('div');
                teamBadge.className = 'team-badge';
                teamBadge.textContent = data.cardType === 'red' ? 'RED' : 'BLUE';
                teamBadge.style.cssText = `
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: ${data.cardType === 'red' ? '#e53e3e' : '#3182ce'};
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    z-index: 10;
                `;
                wordCard.style.position = 'relative';
                wordCard.appendChild(teamBadge);
            } else if (data.cardType === 'neutral') {
                const neutralBadge = document.createElement('div');
                neutralBadge.className = 'neutral-badge';
                neutralBadge.textContent = 'NEUTRAL';
                neutralBadge.style.cssText = `
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: #a0aec0;
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    z-index: 10;
                `;
                wordCard.style.position = 'relative';
                wordCard.appendChild(neutralBadge);
            } else if (data.cardType === 'assassin') {
                const assassinBadge = document.createElement('div');
                assassinBadge.className = 'assassin-badge';
                assassinBadge.textContent = 'ASSASSIN';
                assassinBadge.style.cssText = `
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: #2d3748;
                    color: #e53e3e;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    z-index: 10;
                    border: 2px solid #e53e3e;
                `;
                wordCard.style.position = 'relative';
                wordCard.appendChild(assassinBadge);
            }
        }

        // Update game state
        this.currentGame.revealedWords = data.revealedWords;
        this.currentGame.redScore = data.redScore;
        this.currentGame.blueScore = data.blueScore;
        this.currentGame.redRemaining = data.redRemaining;
        this.currentGame.blueRemaining = data.blueRemaining;
        this.currentGame.guessesRemaining = data.guessesRemaining;

        if (data.switchTeams) {
            this.currentGame.currentTeam = data.currentTeam;
        }

        this.updateGameDisplay();

        if (data.gameOver) {
            console.log('Game over data received:', data);
            console.log('Winner:', data.winner);
            console.log('Clue history from data:', data.clueHistory);
            console.log('All cards from data:', data.allCards);
            this.showGameOverNew(data.winner, data.clueHistory, data.allCards);
        }
    }

    startGame() {
        if (!this.socket) return;
        
        this.socket.emit('start-game', { roomId: this.roomId });
    }

    endTurn() {
        if (!this.socket) return;
        
        this.socket.emit('end-turn', { roomId: this.roomId });
        this.addMessage('Turn ended. Waiting for other team...', 'info');
    }

    leaveGame() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.showWelcomeScreen();
    }

    showWelcomeScreen() {
        this.gameScreen.classList.remove('active');
        this.welcomeScreen.classList.add('active');
        this.currentGame = null;
        this.socket = null;
        
        // Clear chat messages
        if (this.gameMessages) {
            this.gameMessages.innerHTML = '<div class="message system">Welcome to Bytenames AI! The AI spymaster will provide clues to help your team identify your agents.</div>';
        }
    }

    showGameOver(winner) {
        this.gameOverTitle.textContent = 'Game Over!';
        this.gameOverMessage.textContent = `${winner} team wins!`;
        this.gameOverModal.style.display = 'block';
    }

    showGameOverNew(winner, clueHistory, allCards) {
        // Show clue history panel
        const clueHistoryPanel = document.getElementById('clue-history-panel');
        const clueHistoryContent = document.getElementById('clue-history-content');
        
        if (clueHistoryPanel && clueHistoryContent) {
            clueHistoryContent.innerHTML = '';
            
            // Use clue history from current game if not provided in data
            const historyToShow = clueHistory || (this.currentGame && this.currentGame.clueHistory) || [];
            
            console.log('Clue history from data:', clueHistory);
            console.log('Clue history from current game:', this.currentGame ? this.currentGame.clueHistory : 'No current game');
            console.log('History to show:', historyToShow);
            
            if (historyToShow && historyToShow.length > 0) {
                historyToShow.forEach((clue, index) => {
                    const clueItem = document.createElement('div');
                    clueItem.className = `clue-history-item ${clue.team}-team`;
                    
                    const clueText = document.createElement('div');
                    clueText.className = 'clue-history-clue';
                    clueText.textContent = `${clue.clue} ${clue.number}`;
                    
                    const targetsText = document.createElement('div');
                    targetsText.className = 'clue-history-targets';
                    if (clue.targetWords && clue.targetWords.length > 0) {
                        targetsText.innerHTML = `Target words: <strong>${clue.targetWords.join(', ')}</strong>`;
                    } else {
                        targetsText.textContent = `Target words: ${clue.number} words`;
                    }
                    
                    clueItem.appendChild(clueText);
                    clueItem.appendChild(targetsText);
                    clueHistoryContent.appendChild(clueItem);
                });
            } else {
                clueHistoryContent.innerHTML = '<div class="clue-history-item">No clues given in this game.</div>';
            }
            
            clueHistoryPanel.style.display = 'block';
        }
        
        // Show card reveal display
        const cardRevealDisplay = document.getElementById('card-reveal-display');
        const revealGrid = document.getElementById('reveal-grid');
        
        console.log('Card reveal display element:', cardRevealDisplay);
        console.log('Reveal grid element:', revealGrid);
        console.log('All cards data:', allCards);
        
        // Use allCards from data, or fallback to current game data
        const cardsToShow = allCards || (this.currentGame && this.currentGame.words && this.currentGame.agentCards ? 
            this.currentGame.words.map((word, index) => ({
                word,
                type: this.currentGame.agentCards[index]
            })) : null);
        
        console.log('Cards to show:', cardsToShow);
        
        if (cardRevealDisplay && revealGrid && cardsToShow) {
            revealGrid.innerHTML = '';
            
            cardsToShow.forEach((card, index) => {
                const revealCard = document.createElement('div');
                revealCard.className = `reveal-card ${card.type}`;
                revealCard.textContent = card.word;
                
                // Set the data-team attribute for the CSS ::after pseudo-element
                if (card.type === 'assassin') {
                    revealCard.setAttribute('data-team', '✕');
                } else {
                    revealCard.setAttribute('data-team', card.type.toUpperCase());
                }
                
                console.log(`Created reveal card for ${card.word} with type ${card.type} and data-team ${revealCard.getAttribute('data-team')}`);
                revealGrid.appendChild(revealCard);
            });
            
            cardRevealDisplay.style.display = 'block';
        }
        
        // Update start game button to reset the game
        if (this.startGameBtn) {
            this.startGameBtn.textContent = 'New Game';
            this.startGameBtn.disabled = false;
            this.startGameBtn.onclick = () => this.resetGame();
        }
        
        // Add winner message
        this.addMessage(`🎉 ${winner.toUpperCase()} TEAM WINS! 🎉`, 'success');
    }

    playAgain() {
        this.gameOverModal.style.display = 'none';
        // Reset game state but keep teams
        if (this.socket) {
            this.socket.emit('play-again', { roomId: this.roomId });
        }
    }

    resetGame() {
        // Hide clue history and card reveal panels
        const clueHistoryPanel = document.getElementById('clue-history-panel');
        const cardRevealDisplay = document.getElementById('card-reveal-display');
        
        if (clueHistoryPanel) {
            clueHistoryPanel.style.display = 'none';
        }
        if (cardRevealDisplay) {
            cardRevealDisplay.style.display = 'none';
        }
        
        // Reset start game button
        if (this.startGameBtn) {
            this.startGameBtn.textContent = 'Start Game';
            this.startGameBtn.onclick = () => this.startGame();
        }
        
        // Reset the game with new words (like play-again)
        if (this.socket) {
            this.socket.emit('play-again', { roomId: this.roomId });
        }
    }

    newRoom() {
        this.gameOverModal.style.display = 'none';
        this.showWelcomeScreen();
    }

    showLoading(show) {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    showMessage(message, type) {
        console.log(`${type.toUpperCase()}: ${message}`);
        // You can add visual message display here
    }

    addMessage(message, type) {
        if (!this.gameMessages) return;
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${type}`;
        messageEl.textContent = message;
        this.gameMessages.appendChild(messageEl);
        this.gameMessages.scrollTop = this.gameMessages.scrollHeight;
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BytenamesGame();
});