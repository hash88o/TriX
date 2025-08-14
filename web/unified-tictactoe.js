class TriXTicTacToeGame {
    constructor() {
        // Wallet and blockchain
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.contracts = {};

        // Game state
        this.socket = null;
        this.currentMatch = null;
        this.gameState = {
            board: Array(9).fill(''),
            mySymbol: null,
            currentPlayer: 'X',
            gameActive: false,
            isMyTurn: false
        };

        // Contract addresses from deployed TriX platform
        this.contractAddresses = {
            gameToken: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
            tokenStore: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
            playGame: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
            mockUSDT: '0x9A676e781A523b5d0C0e43731313A708CB607508'
        };

        // API endpoints - all on same frontend server
        this.apiUrl = 'http://localhost:8080/api'; // TriX API proxied
        this.matchmakingUrl = 'http://localhost:8080'; // Matchmaking on same server

        this.init();
    }

    async init() {
        this.setupEventListeners();
        console.log('🎮 TriX Tic-Tac-Toe Game initialized');
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());

        // Token purchase
        document.getElementById('buyGT').addEventListener('click', () => this.buyGTTokens());

        // Game flow
        document.getElementById('findMatch').addEventListener('click', () => this.findMatch());
        document.getElementById('confirmStake').addEventListener('click', () => this.confirmStake());
        document.getElementById('cancelMatch').addEventListener('click', () => this.cancelMatch());
        document.getElementById('forfeitGame').addEventListener('click', () => this.forfeitGame());
        document.getElementById('playAgain').addEventListener('click', () => this.playAgain());

        // Game board
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.makeMove(parseInt(e.target.dataset.index)));
        });
    }

    async connectWallet() {
        try {
            // Check if MetaMask is installed
            if (typeof window.ethereum === 'undefined') {
                alert('Please install MetaMask to play TriX games!');
                return;
            }

            // Check if ethers is loaded
            if (typeof ethers === 'undefined') {
                alert('Ethers.js library not loaded. Please refresh the page.');
                return;
            }

            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.address = accounts[0];

            // Create provider and signer (ethers v6 syntax)
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();

            // Initialize contracts
            await this.initializeContracts();

            // Load balances
            await this.loadBalances();

            // Update UI
            this.showWalletInfo();

            console.log('✅ Wallet connected:', this.address);

        } catch (error) {
            console.error('❌ Failed to connect wallet:', error);
            alert('Failed to connect wallet: ' + error.message);
        }
    }

    async initializeContracts() {
        try {
            // GameToken contract
            const gameTokenABI = [
                "function balanceOf(address) view returns (uint256)",
                "function approve(address,uint256) returns (bool)",
                "function transfer(address,uint256) returns (bool)",
                "function allowance(address,address) view returns (uint256)"
            ];

            this.contracts.gameToken = new ethers.Contract(
                this.contractAddresses.gameToken,
                gameTokenABI,
                this.signer
            );

            // TokenStore contract
            const tokenStoreABI = [
                "function buy(uint256) external",
                "function getGTAmount(uint256) view returns (uint256)"
            ];

            this.contracts.tokenStore = new ethers.Contract(
                this.contractAddresses.tokenStore,
                tokenStoreABI,
                this.signer
            );

            // PlayGame contract
            const playGameABI = [
                "function createMatch(bytes32,address,address,uint256) external",
                "function stake(bytes32) external",
                "function commitResult(bytes32,address) external",
                "function getMatch(bytes32) view returns (tuple(bytes32,address,address,uint256,uint8,uint256,bool,bool))"
            ];

            this.contracts.playGame = new ethers.Contract(
                this.contractAddresses.playGame,
                playGameABI,
                this.signer
            );

            console.log('✅ Contracts initialized');

        } catch (error) {
            console.error('❌ Failed to initialize contracts:', error);
            throw error;
        }
    }

    async loadBalances() {
        try {
            // ETH balance
            const ethBalance = await this.provider.getBalance(this.address);
            document.getElementById('ethBalance').textContent =
                parseFloat(ethers.formatEther(ethBalance)).toFixed(4);

            // GT balance
            const gtBalance = await this.contracts.gameToken.balanceOf(this.address);
            document.getElementById('gtBalance').textContent =
                parseFloat(ethers.formatUnits(gtBalance, 18)).toFixed(2);

            // USDT balance (mock - in real app would query contract)
            document.getElementById('usdtBalance').textContent = '1000';

        } catch (error) {
            console.error('❌ Failed to load balances:', error);
        }
    }

    showWalletInfo() {
        // Show wallet address
        document.getElementById('walletAddress').textContent =
            this.address.substring(0, 6) + '...' + this.address.substring(38);

        // Hide connect section, show wallet info
        document.getElementById('connectSection').classList.add('hidden');
        document.getElementById('walletInfo').classList.remove('hidden');
    }

    async buyGTTokens() {
        try {
            const usdtAmount = document.getElementById('usdtAmount').value;
            if (!usdtAmount || usdtAmount <= 0) {
                alert('Please enter a valid USDT amount');
                return;
            }

            // Convert USDT amount to wei (6 decimals)
            const usdtAmountWei = ethers.parseUnits(usdtAmount, 6);

            // Buy GT tokens through TokenStore
            const tx = await this.contracts.tokenStore.buy(usdtAmountWei);
            console.log('🔄 Buying GT tokens...', tx.hash);

            // Wait for confirmation
            await tx.wait();

            // Reload balances
            await this.loadBalances();

            alert(`✅ Successfully bought ${usdtAmount} GT tokens!`);

        } catch (error) {
            console.error('❌ Failed to buy GT tokens:', error);
            alert('Failed to buy GT tokens: ' + error.message);
        }
    }

    async findMatch() {
        try {
            const stakeAmount = document.getElementById('stakeAmount').value;
            if (!stakeAmount || stakeAmount <= 0) {
                alert('Please enter a valid stake amount');
                return;
            }

            // Check GT balance
            const gtBalance = await this.contracts.gameToken.balanceOf(this.address);
            const stakeAmountWei = ethers.parseUnits(stakeAmount, 18);

            if (gtBalance.lt(stakeAmountWei)) {
                alert('Insufficient GT balance. Please buy more GT tokens.');
                return;
            }

            // Show searching status
            document.getElementById('searchingStatus').classList.remove('hidden');
            document.getElementById('findMatch').disabled = true;

            // Connect to matchmaking server
            await this.connectToMatchmaking();

            // Send match request
            this.socket.emit('findMatch', {
                address: this.address,
                stake: parseFloat(stakeAmount),
                timestamp: Date.now()
            });

            console.log(`🔍 Searching for opponent with ${stakeAmount} GT stake...`);

        } catch (error) {
            console.error('❌ Failed to find match:', error);
            alert('Failed to find match: ' + error.message);
            this.resetMatchmaking();
        }
    }

    async connectToMatchmaking() {
        return new Promise((resolve, reject) => {
            this.socket = io(this.matchmakingUrl);

            this.socket.on('connect', () => {
                console.log('🔗 Connected to matchmaking server');
                resolve();
            });

            this.socket.on('matchFound', (matchData) => {
                this.handleMatchFound(matchData);
            });

            this.socket.on('bothStaked', (matchData) => {
                this.startGame(matchData);
            });

            this.socket.on('opponentMove', (moveData) => {
                this.handleOpponentMove(moveData);
            });

            this.socket.on('gameEnd', (resultData) => {
                this.handleGameEnd(resultData);
            });

            this.socket.on('connect_error', (error) => {
                console.error('❌ Matchmaking connection error:', error);
                reject(error);
            });
        });
    }

    handleMatchFound(matchData) {
        console.log('🎉 Match found:', matchData);

        this.currentMatch = matchData;

        // Hide searching, show match found
        document.getElementById('searchingStatus').classList.add('hidden');
        document.getElementById('startGameSection').classList.add('hidden');
        document.getElementById('matchFoundSection').classList.remove('hidden');

        // Update match info
        const opponent = matchData.player1 === this.address ? matchData.player2 : matchData.player1;
        document.getElementById('opponentAddress').textContent =
            opponent.substring(0, 6) + '...' + opponent.substring(38);
        document.getElementById('matchStake').textContent = matchData.stake;
        document.getElementById('totalPot').textContent = matchData.stake * 2;
        document.getElementById('winnerAmount').textContent = matchData.stake * 2;
    }

    async confirmStake() {
        try {
            const stakeAmountWei = ethers.parseUnits(this.currentMatch.stake.toString(), 18);

            // Step 1: Approve GT spending
            console.log('🔄 Approving GT token spending...');
            const approveTx = await this.contracts.gameToken.approve(
                this.contractAddresses.playGame,
                stakeAmountWei
            );
            await approveTx.wait();

            // Step 2: Create match on blockchain (via API)
            console.log('🔄 Creating match on blockchain...');
            const matchResponse = await fetch(`${this.apiUrl}/match/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    p1: this.currentMatch.player1,
                    p2: this.currentMatch.player2,
                    stake: this.currentMatch.stake,
                    matchId: this.currentMatch.matchId
                })
            });

            if (!matchResponse.ok) {
                throw new Error('Failed to create match on blockchain');
            }

            const matchResult = await matchResponse.json();
            this.currentMatch.blockchainMatchId = matchResult.matchId;

            // Step 3: Stake tokens
            console.log('🔄 Staking GT tokens...');
            const stakeTx = await this.contracts.playGame.stake(matchResult.matchId);
            await stakeTx.wait();

            // Reload balances
            await this.loadBalances();

            // Show waiting for opponent
            document.getElementById('stakingStatus').classList.remove('hidden');
            document.getElementById('confirmStake').disabled = true;

            // Notify matchmaking server
            this.socket.emit('playerStaked', {
                matchId: this.currentMatch.matchId,
                address: this.address
            });

            console.log('✅ Successfully staked tokens');

        } catch (error) {
            console.error('❌ Failed to stake tokens:', error);
            alert('Failed to stake tokens: ' + error.message);
        }
    }

    cancelMatch() {
        if (this.socket) {
            this.socket.emit('cancelMatch', {
                matchId: this.currentMatch?.matchId,
                address: this.address
            });
        }

        this.resetToStart();
    }

    startGame(matchData) {
        console.log('🎮 Both players staked! Starting game...');

        // Set player symbol
        this.gameState.mySymbol = matchData.player1 === this.address ? 'X' : 'O';
        this.gameState.currentPlayer = 'X';
        this.gameState.gameActive = true;
        this.gameState.isMyTurn = this.gameState.mySymbol === 'X';

        // Reset board
        this.gameState.board = Array(9).fill('');
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('disabled', 'x', 'o');
        });

        // Show game section
        document.getElementById('matchFoundSection').classList.add('hidden');
        document.getElementById('gamePlaySection').classList.remove('hidden');

        // Update game info
        document.getElementById('gameMatchId').textContent = this.currentMatch.matchId;
        document.getElementById('playerSymbol').textContent = this.gameState.mySymbol;
        this.updateTurnDisplay();
    }

    makeMove(index) {
        if (!this.gameState.gameActive ||
            !this.gameState.isMyTurn ||
            this.gameState.board[index] !== '') {
            return;
        }

        // Make move locally
        this.gameState.board[index] = this.gameState.mySymbol;
        document.querySelectorAll('.cell')[index].textContent = this.gameState.mySymbol;
        document.querySelectorAll('.cell')[index].classList.add(this.gameState.mySymbol.toLowerCase());

        // Check for win/draw
        const winner = this.checkWinner();
        const isDraw = this.checkDraw();

        if (winner || isDraw) {
            this.endGame(winner, isDraw);
        } else {
            // Switch turns
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'X' ? 'O' : 'X';
            this.gameState.isMyTurn = this.gameState.currentPlayer === this.gameState.mySymbol;
            this.updateTurnDisplay();
        }

        // Send move to opponent
        this.socket.emit('makeMove', {
            matchId: this.currentMatch.matchId,
            index: index,
            symbol: this.gameState.mySymbol,
            board: this.gameState.board
        });
    }

    handleOpponentMove(moveData) {
        if (!this.gameState.gameActive) return;

        // Update board with opponent's move
        this.gameState.board = moveData.board;
        document.querySelectorAll('.cell')[moveData.index].textContent = moveData.symbol;
        document.querySelectorAll('.cell')[moveData.index].classList.add(moveData.symbol.toLowerCase());

        // Check for win/draw
        const winner = this.checkWinner();
        const isDraw = this.checkDraw();

        if (winner || isDraw) {
            this.endGame(winner, isDraw);
        } else {
            // Switch turns
            this.gameState.currentPlayer = this.gameState.currentPlayer === 'X' ? 'O' : 'X';
            this.gameState.isMyTurn = this.gameState.currentPlayer === this.gameState.mySymbol;
            this.updateTurnDisplay();
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
            document.getElementById('gameStatus').textContent = "🤝 It's a draw!";
            document.getElementById('gameStatus').className = 'status warning';
        } else if (winner === this.gameState.mySymbol) {
            result = 'WIN';
            document.getElementById('gameStatus').textContent = "🎉 You won!";
            document.getElementById('gameStatus').className = 'status success';
        } else {
            result = 'LOSE';
            document.getElementById('gameStatus').textContent = "😔 You lost!";
            document.getElementById('gameStatus').className = 'status error';
        }

        // Submit result to blockchain and process payout
        await this.submitGameResult(result, winner);
    }

    async submitGameResult(result, winner) {
        try {
            console.log('🔄 Submitting game result to blockchain...');

            const winnerAddress = result === 'DRAW' ? ethers.constants.AddressZero :
                result === 'WIN' ? this.address :
                    (this.currentMatch.player1 === this.address ? this.currentMatch.player2 : this.currentMatch.player1);

            // Submit result via TriX API (which calls the smart contract)
            const resultResponse = await fetch(`${this.apiUrl}/match/result`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    matchId: this.currentMatch.blockchainMatchId,
                    winner: winnerAddress
                })
            });

            if (!resultResponse.ok) {
                throw new Error('Failed to submit game result');
            }

            const resultData = await resultResponse.json();

            // Show result section
            document.getElementById('gamePlaySection').classList.add('hidden');
            document.getElementById('gameResultSection').classList.remove('hidden');

            // Update result info
            if (result === 'WIN') {
                document.getElementById('resultStatus').textContent = '🎉 You won! Congratulations!';
                document.getElementById('resultStatus').className = 'status success';
                document.getElementById('gameWinner').textContent = 'You';
                document.getElementById('payoutAmount').textContent = this.currentMatch.stake * 2;
            } else if (result === 'LOSE') {
                document.getElementById('resultStatus').textContent = '😔 You lost! Better luck next time!';
                document.getElementById('resultStatus').className = 'status error';
                document.getElementById('gameWinner').textContent = 'Opponent';
                document.getElementById('payoutAmount').textContent = this.currentMatch.stake * 2;
            } else {
                document.getElementById('resultStatus').textContent = "🤝 It's a draw! Stakes returned.";
                document.getElementById('resultStatus').className = 'status warning';
                document.getElementById('gameWinner').textContent = 'No winner';
                document.getElementById('payoutAmount').textContent = this.currentMatch.stake;
            }

            document.getElementById('txLink').href = `https://etherscan.io/tx/${resultData.txHash}`;

            // Reload balances to show updated GT
            await this.loadBalances();

            console.log('✅ Game result submitted and payout processed!');

        } catch (error) {
            console.error('❌ Failed to submit game result:', error);
            alert('Failed to process game result: ' + error.message);
        }
    }

    forfeitGame() {
        if (confirm('Are you sure you want to forfeit? You will lose your stake.')) {
            this.gameState.gameActive = false;

            if (this.socket) {
                this.socket.emit('forfeitMatch', {
                    matchId: this.currentMatch.matchId,
                    address: this.address
                });
            }

            // Process as loss
            this.submitGameResult('LOSE',
                this.currentMatch.player1 === this.address ? this.currentMatch.player2 : this.currentMatch.player1);
        }
    }

    playAgain() {
        this.resetToStart();
        this.loadBalances(); // Refresh balances for new game
    }

    updateTurnDisplay() {
        const turnText = this.gameState.isMyTurn ?
            `Your turn (${this.gameState.mySymbol})` :
            `Opponent's turn`;
        document.getElementById('currentTurn').textContent = turnText;
        document.getElementById('gameStatus').textContent = turnText;
        document.getElementById('gameStatus').className = 'status info';
    }

    resetMatchmaking() {
        document.getElementById('searchingStatus').classList.add('hidden');
        document.getElementById('findMatch').disabled = false;
    }

    resetToStart() {
        // Reset game state
        this.currentMatch = null;
        this.gameState = {
            board: Array(9).fill(''),
            mySymbol: null,
            currentPlayer: 'X',
            gameActive: false,
            isMyTurn: false
        };

        // Reset UI
        document.getElementById('startGameSection').classList.remove('hidden');
        document.getElementById('matchFoundSection').classList.add('hidden');
        document.getElementById('gamePlaySection').classList.add('hidden');
        document.getElementById('gameResultSection').classList.add('hidden');
        document.getElementById('searchingStatus').classList.add('hidden');
        document.getElementById('stakingStatus').classList.add('hidden');

        // Re-enable buttons
        document.getElementById('findMatch').disabled = false;
        document.getElementById('confirmStake').disabled = false;

        // Clear form
        document.getElementById('stakeAmount').value = '';

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    handleGameEnd(resultData) {
        console.log('🏁 Game ended:', resultData);
        // Game end is handled by local game logic
    }
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.triXGame = new TriXTicTacToeGame();
});
