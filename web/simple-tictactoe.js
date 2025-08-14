class SimpleTicTacToe {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.contracts = {};
        this.socket = null;
        this.gameState = {
            board: Array(9).fill(''),
            currentPlayer: 'X',
            mySymbol: null,
            gameActive: false,
            matchId: null,
            stake: 0,
            opponent: null
        };

        // Contract addresses from deployment
        this.contractAddresses = {
            gameToken: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
            tokenStore: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
            playGame: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
            mockUSDT: '0x9A676e781A523b5d0C0e43731313A708CB607508'
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('Simple Tic-Tac-Toe initialized');
    }

    setupEventListeners() {
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
        document.getElementById('buyGT').addEventListener('click', () => this.buyGT());
        document.getElementById('startGame').addEventListener('click', () => this.startGame());
        document.getElementById('confirmStake').addEventListener('click', () => this.confirmStake());
        document.getElementById('cancelGame').addEventListener('click', () => this.cancelGame());
        document.getElementById('forfeit').addEventListener('click', () => this.forfeitGame());
        document.getElementById('playAgain').addEventListener('click', () => this.playAgain());

        // Game board
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.makeMove(parseInt(e.target.dataset.index)));
        });
    }

    async connectWallet() {
        try {
            // Check MetaMask
            if (typeof window.ethereum === 'undefined') {
                alert('Please install MetaMask!');
                return;
            }

            // Check Ethers
            if (typeof ethers === 'undefined') {
                alert('Ethers.js not loaded. Please refresh the page.');
                return;
            }

            // Connect
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.address = accounts[0];

            // Setup provider
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();

            // Initialize contracts
            await this.initializeContracts();

            // Update UI
            document.getElementById('walletAddress').textContent =
                this.address.substring(0, 6) + '...' + this.address.substring(38);
            document.getElementById('walletInfo').classList.remove('hidden');
            document.getElementById('buySection').classList.remove('hidden');
            document.getElementById('gameStartSection').classList.remove('hidden');

            // Load balance
            await this.loadGTBalance();

            console.log('Wallet connected:', this.address);

        } catch (error) {
            console.error('Failed to connect wallet:', error);
            alert('Failed to connect wallet: ' + error.message);
        }
    }

    async initializeContracts() {
        // Simple contract ABIs
        const gameTokenABI = [
            "function balanceOf(address) view returns (uint256)",
            "function approve(address,uint256) returns (bool)",
            "function transfer(address,uint256) returns (bool)"
        ];

        const tokenStoreABI = [
            "function buy(uint256) external"
        ];

        const playGameABI = [
            "function createMatch(bytes32,address,address,uint256) external",
            "function stake(bytes32) external",
            "function commitResult(bytes32,address) external"
        ];

        this.contracts.gameToken = new ethers.Contract(
            this.contractAddresses.gameToken,
            gameTokenABI,
            this.signer
        );

        this.contracts.tokenStore = new ethers.Contract(
            this.contractAddresses.tokenStore,
            tokenStoreABI,
            this.signer
        );

        this.contracts.playGame = new ethers.Contract(
            this.contractAddresses.playGame,
            playGameABI,
            this.signer
        );
    }

    async loadGTBalance() {
        try {
            const balance = await this.contracts.gameToken.balanceOf(this.address);
            const balanceFormatted = ethers.utils.formatUnits(balance, 18);
            document.getElementById('gtBalance').textContent = parseFloat(balanceFormatted).toFixed(2);
        } catch (error) {
            console.error('Failed to load GT balance:', error);
        }
    }

    async buyGT() {
        try {
            const usdtAmount = document.getElementById('usdtAmount').value;
            if (!usdtAmount || usdtAmount <= 0) {
                alert('Please enter a valid USDT amount');
                return;
            }

            // Convert to wei (assuming 6 decimals for USDT)
            const usdtAmountWei = ethers.utils.parseUnits(usdtAmount, 6);

            // Buy GT tokens
            const tx = await this.contracts.tokenStore.buy(usdtAmountWei);
            console.log('Buying GT tokens...', tx.hash);

            // Wait for confirmation
            await tx.wait();

            // Reload balance
            await this.loadGTBalance();

            alert(`Successfully bought ${usdtAmount} GT tokens!`);

        } catch (error) {
            console.error('Failed to buy GT:', error);
            alert('Failed to buy GT tokens: ' + error.message);
        }
    }

    async startGame() {
        try {
            const stakeAmount = document.getElementById('stakeAmount').value;
            if (!stakeAmount || stakeAmount <= 0) {
                alert('Please enter a valid stake amount');
                return;
            }

            // Check balance
            const balance = await this.contracts.gameToken.balanceOf(this.address);
            const stakeAmountWei = ethers.utils.parseUnits(stakeAmount, 18);

            if (balance.lt(stakeAmountWei)) {
                alert('Insufficient GT balance');
                return;
            }

            // Show searching status
            document.getElementById('searchingStatus').classList.remove('hidden');
            document.getElementById('startGame').disabled = true;

            // Connect to matchmaking server
            await this.connectToMatchmaking();

            // Send match request
            this.socket.emit('findMatch', {
                address: this.address,
                stake: parseFloat(stakeAmount),
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Failed to start game:', error);
            alert('Failed to start game: ' + error.message);
            document.getElementById('searchingStatus').classList.add('hidden');
            document.getElementById('startGame').disabled = false;
        }
    }

    async connectToMatchmaking() {
        return new Promise((resolve, reject) => {
            this.socket = io('http://localhost:3001');

            this.socket.on('connect', () => {
                console.log('Connected to matchmaking server');
                resolve();
            });

            this.socket.on('matchFound', (matchData) => {
                this.handleMatchFound(matchData);
            });

            this.socket.on('bothStaked', (matchData) => {
                this.startGamePlay(matchData);
            });

            this.socket.on('opponentMove', (moveData) => {
                this.handleOpponentMove(moveData);
            });

            this.socket.on('gameEnd', (resultData) => {
                this.handleGameEnd(resultData);
            });

            this.socket.on('connect_error', (error) => {
                console.error('Connection error:', error);
                reject(error);
            });
        });
    }

    handleMatchFound(matchData) {
        console.log('Match found:', matchData);

        this.gameState.matchId = matchData.matchId;
        this.gameState.stake = matchData.stake;
        this.gameState.opponent = matchData.player1 === this.address ? matchData.player2 : matchData.player1;

        // Hide searching, show stake confirmation
        document.getElementById('searchingStatus').classList.add('hidden');
        document.getElementById('gameStartSection').classList.add('hidden');
        document.getElementById('stakeSection').classList.remove('hidden');

        // Update match info
        document.getElementById('opponentAddress').textContent =
            this.gameState.opponent.substring(0, 6) + '...' + this.gameState.opponent.substring(38);
        document.getElementById('matchStake').textContent = matchData.stake;
        document.getElementById('totalPot').textContent = matchData.stake * 2;
    }

    async confirmStake() {
        try {
            const stakeAmountWei = ethers.utils.parseUnits(this.gameState.stake.toString(), 18);

            // First approve
            const approveTx = await this.contracts.gameToken.approve(
                this.contractAddresses.playGame,
                stakeAmountWei
            );
            console.log('Approving GT spending...', approveTx.hash);
            await approveTx.wait();

            // Then stake
            const stakeTx = await this.contracts.playGame.stake(this.gameState.matchId);
            console.log('Staking GT tokens...', stakeTx.hash);
            await stakeTx.wait();

            // Reload balance
            await this.loadGTBalance();

            // Show waiting status
            document.getElementById('stakingStatus').classList.remove('hidden');
            document.getElementById('confirmStake').disabled = true;

            // Notify server
            this.socket.emit('playerStaked', {
                matchId: this.gameState.matchId,
                address: this.address
            });

        } catch (error) {
            console.error('Failed to stake:', error);
            alert('Failed to stake tokens: ' + error.message);
        }
    }

    cancelGame() {
        // Reset and go back
        this.gameState = {
            board: Array(9).fill(''),
            currentPlayer: 'X',
            mySymbol: null,
            gameActive: false,
            matchId: null,
            stake: 0,
            opponent: null
        };

        if (this.socket) {
            this.socket.emit('cancelMatch', {
                matchId: this.gameState.matchId,
                address: this.address
            });
        }

        this.showSection('gameStartSection');
    }

    startGamePlay(matchData) {
        console.log('Both players staked, starting game');

        // Set player symbol (player1 = X, player2 = O)
        this.gameState.mySymbol = matchData.player1 === this.address ? 'X' : 'O';
        this.gameState.gameActive = true;
        this.gameState.currentPlayer = 'X';

        // Reset board
        this.gameState.board = Array(9).fill('');
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('disabled');
        });

        // Show game section
        document.getElementById('stakeSection').classList.add('hidden');
        document.getElementById('gameSection').classList.remove('hidden');

        // Update status
        const isMyTurn = this.gameState.currentPlayer === this.gameState.mySymbol;
        document.getElementById('gameStatus').textContent =
            isMyTurn ? `Your turn (${this.gameState.mySymbol})` : `Opponent's turn`;
        document.getElementById('gameStatus').className = 'status info';
    }

    makeMove(index) {
        if (!this.gameState.gameActive ||
            this.gameState.board[index] !== '' ||
            this.gameState.currentPlayer !== this.gameState.mySymbol) {
            return;
        }

        // Make move
        this.gameState.board[index] = this.gameState.mySymbol;
        document.querySelectorAll('.cell')[index].textContent = this.gameState.mySymbol;

        // Check for win/draw
        const winner = this.checkWinner();
        const isDraw = this.checkDraw();

        if (winner || isDraw) {
            this.endGame(winner, isDraw);
        } else {
            // Switch turns
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'X' ? 'O' : 'X';
            const isMyTurn = this.gameState.currentPlayer === this.gameState.mySymbol;
            document.getElementById('gameStatus').textContent =
                isMyTurn ? `Your turn (${this.gameState.mySymbol})` : `Opponent's turn`;
        }

        // Send move to opponent
        this.socket.emit('makeMove', {
            matchId: this.gameState.matchId,
            index: index,
            symbol: this.gameState.mySymbol,
            board: this.gameState.board
        });
    }

    handleOpponentMove(moveData) {
        if (!this.gameState.gameActive) return;

        // Update board
        this.gameState.board = moveData.board;
        document.querySelectorAll('.cell')[moveData.index].textContent = moveData.symbol;

        // Check for win/draw
        const winner = this.checkWinner();
        const isDraw = this.checkDraw();

        if (winner || isDraw) {
            this.endGame(winner, isDraw);
        } else {
            // Switch turns
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'X' ? 'O' : 'X';
            const isMyTurn = this.gameState.currentPlayer === this.gameState.mySymbol;
            document.getElementById('gameStatus').textContent =
                isMyTurn ? `Your turn (${this.gameState.mySymbol})` : `Opponent's turn`;
        }
    }

    checkWinner() {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            if (this.gameState.board[a] &&
                this.gameState.board[a] === this.gameState.board[b] &&
                this.gameState.board[a] === this.gameState.board[c]) {
                return this.gameState.board[a];
            }
        }
        return null;
    }

    checkDraw() {
        return this.gameState.board.every(cell => cell !== '');
    }

    async endGame(winner, isDraw) {
        this.gameState.gameActive = false;

        // Disable all cells
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });

        let result;
        if (isDraw) {
            result = 'DRAW';
            document.getElementById('gameStatus').textContent = "It's a draw!";
            document.getElementById('gameStatus').className = 'status info';
        } else if (winner === this.gameState.mySymbol) {
            result = 'WIN';
            document.getElementById('gameStatus').textContent = "You won! 🎉";
            document.getElementById('gameStatus').className = 'status success';
        } else {
            result = 'LOSE';
            document.getElementById('gameStatus').textContent = "You lost 😔";
            document.getElementById('gameStatus').className = 'status error';
        }

        // Process result on blockchain
        await this.processGameResult(result, winner);

        // Show result section after delay
        setTimeout(() => {
            this.showGameResult(result, winner);
        }, 2000);
    }

    async processGameResult(result, winner) {
        try {
            const winnerAddress = result === 'DRAW' ? ethers.constants.AddressZero :
                result === 'WIN' ? this.address : this.gameState.opponent;

            // Commit result to blockchain
            const tx = await this.contracts.playGame.commitResult(this.gameState.matchId, winnerAddress);
            console.log('Committing result...', tx.hash);

            await tx.wait();
            console.log('Result committed successfully');

            // Reload balance
            await this.loadGTBalance();

        } catch (error) {
            console.error('Failed to commit result:', error);
        }
    }

    showGameResult(result, winner) {
        document.getElementById('gameSection').classList.add('hidden');
        document.getElementById('resultSection').classList.remove('hidden');

        let message, winnerAddr, payout;

        if (result === 'DRAW') {
            message = "It's a draw! Stakes returned to both players.";
            winnerAddr = 'No winner';
            payout = this.gameState.stake;
        } else if (result === 'WIN') {
            message = "🎉 You won! Congratulations!";
            winnerAddr = this.address.substring(0, 6) + '...' + this.address.substring(38);
            payout = this.gameState.stake * 2;
        } else {
            message = "😔 You lost. Better luck next time!";
            winnerAddr = this.gameState.opponent.substring(0, 6) + '...' + this.gameState.opponent.substring(38);
            payout = this.gameState.stake * 2;
        }

        document.getElementById('resultMessage').textContent = message;
        document.getElementById('winnerAddress').textContent = winnerAddr;
        document.getElementById('payoutAmount').textContent = payout;

        if (result === 'WIN') {
            document.getElementById('resultMessage').className = 'status success';
        } else if (result === 'LOSE') {
            document.getElementById('resultMessage').className = 'status error';
        } else {
            document.getElementById('resultMessage').className = 'status info';
        }
    }

    playAgain() {
        // Reset game state
        this.gameState = {
            board: Array(9).fill(''),
            currentPlayer: 'X',
            mySymbol: null,
            gameActive: false,
            matchId: null,
            stake: 0,
            opponent: null
        };

        // Reset UI
        document.getElementById('startGame').disabled = false;
        document.getElementById('confirmStake').disabled = false;

        // Show game start section
        this.showSection('gameStartSection');
    }

    forfeitGame() {
        if (confirm('Are you sure you want to forfeit? You will lose your stake.')) {
            this.gameState.gameActive = false;

            // Notify server
            this.socket.emit('forfeitMatch', {
                matchId: this.gameState.matchId,
                address: this.address
            });

            // Process as loss
            this.processGameResult('LOSE', this.gameState.opponent);
            this.showGameResult('LOSE', this.gameState.opponent);
        }
    }

    handleGameEnd(resultData) {
        console.log('Game ended:', resultData);
        // Game end is handled by local game logic
    }

    showSection(sectionId) {
        // Hide all game sections
        ['connectSection', 'buySection', 'gameStartSection', 'stakeSection', 'gameSection', 'resultSection'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.classList.add('hidden');
            }
        });

        // Show target section
        const target = document.getElementById(sectionId);
        if (target) {
            target.classList.remove('hidden');
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.simpleTicTacToe = new SimpleTicTacToe();
});
