// TriX Tic-Tac-Toe Game - Main JavaScript
class TriXTicTacToe {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.contracts = {};
        this.gameState = {
            currentMatch: null,
            board: Array(9).fill(''),
            currentPlayer: 'X',
            gameActive: false,
            mySymbol: null,
            isMyTurn: false
        };
        this.socket = null;
        this.matchmaking = false;

        // Contract addresses
        this.contractAddresses = {
            gameToken: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
            tokenStore: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
            playGame: '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE',
            mockUSDT: '0x9A676e781A523b5d0C0e43731313A708CB607508'
        };

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadContractAddresses();
        this.loadLeaderboard();
    }

    setupEventListeners() {
        // Wallet connection
        const connectWallet = document.getElementById('connectWallet');
        if (connectWallet) {
            connectWallet.addEventListener('click', () => this.connectWallet());
        }

        // Token purchase
        const buyGT = document.getElementById('buyGT');
        if (buyGT) {
            buyGT.addEventListener('click', () => this.buyGT());
        }

        const usdtAmount = document.getElementById('usdtAmount');
        if (usdtAmount) {
            usdtAmount.addEventListener('input', (e) => this.updateGTAmount(e.target.value));
        }

        // Matchmaking
        const findMatch = document.getElementById('findMatch');
        if (findMatch) {
            findMatch.addEventListener('click', () => this.findMatch());
        }

        // Stake confirmation
        const approveAndStake = document.getElementById('approveAndStake');
        if (approveAndStake) {
            approveAndStake.addEventListener('click', () => this.approveAndStake());
        }

        const cancelMatch = document.getElementById('cancelMatch');
        if (cancelMatch) {
            cancelMatch.addEventListener('click', () => this.cancelMatch());
        }

        // Game actions
        const forfeitButton = document.getElementById('forfeitButton');
        if (forfeitButton) {
            forfeitButton.addEventListener('click', () => this.forfeitMatch());
        }

        // History actions
        const playAgain = document.getElementById('playAgain');
        if (playAgain) {
            playAgain.addEventListener('click', () => this.playAgain());
        }

        const viewLeaderboard = document.getElementById('viewLeaderboard');
        if (viewLeaderboard) {
            viewLeaderboard.addEventListener('click', () => this.showDashboard());
        }

        // Game board
        document.querySelectorAll('.cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.makeMove(e.target));
        });

        // Modal
        const closeBtn = document.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });
    }

    async loadContractAddresses() {
        try {
            // Contract addresses are already set in constructor
            console.log('Contract addresses loaded');
        } catch (error) {
            console.error('Failed to load contract addresses:', error);
        }
    }

    async connectWallet() {
        try {
            this.showLoading('Connecting to MetaMask...');

            // Check if MetaMask is installed
            if (typeof window.ethereum === 'undefined') {
                this.hideLoading();
                this.showModal('MetaMask not found', 'Please install MetaMask to use this application.');
                return;
            }

            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.address = accounts[0];

            // Check if ethers is loaded
            if (typeof ethers === 'undefined') {
                this.hideLoading();
                this.showModal('Ethers.js not loaded', 'Please refresh the page and try again.');
                return;
            }

            // Create provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();

            // Initialize contracts
            await this.initializeContracts();

            // Load balances
            await this.loadBalances();

            // Setup network change listener
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnectWallet();
                } else {
                    this.address = accounts[0];
                    this.loadBalances();
                }
            });

            this.hideLoading();
            this.showDashboard();
            this.logTransaction('Wallet connected successfully', 'success');

        } catch (error) {
            this.hideLoading();
            console.error('Failed to connect wallet:', error);
            this.showModal('Connection Failed', 'Failed to connect to MetaMask. Please try again.');
        }
    }

    async initializeContracts() {
        try {
            // GameToken contract
            const gameTokenABI = [
                "function balanceOf(address) view returns (uint256)",
                "function transfer(address,uint256) returns (bool)",
                "function transferFrom(address,address,uint256) returns (bool)",
                "function approve(address,uint256) returns (bool)",
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

        } catch (error) {
            console.error('Failed to initialize contracts:', error);
            throw error;
        }
    }

    async loadBalances() {
        try {
            // ETH balance
            const ethBalance = await this.provider.getBalance(this.address);
            document.getElementById('ethBalance').textContent = ethers.utils.formatEther(ethBalance);

            // GT balance
            const gtBalance = await this.contracts.gameToken.balanceOf(this.address);
            document.getElementById('gtBalance').textContent = ethers.utils.formatUnits(gtBalance, 18);

            // USDT balance (mock)
            document.getElementById('usdtBalance').textContent = '1000'; // Mock balance

            // Show wallet info
            document.getElementById('walletInfo').style.display = 'flex';
            document.getElementById('walletAddress').textContent =
                this.address.substring(0, 6) + '...' + this.address.substring(38);

        } catch (error) {
            console.error('Failed to load balances:', error);
        }
    }

    updateGTAmount(usdtAmount) {
        const gtAmount = usdtAmount || 0;
        document.getElementById('gtAmount').textContent = gtAmount;
    }

    async buyGT() {
        try {
            const usdtAmount = document.getElementById('usdtAmount').value;
            if (!usdtAmount || usdtAmount <= 0) {
                this.showModal('Invalid Amount', 'Please enter a valid USDT amount.');
                return;
            }

            this.showLoading('Purchasing GT tokens...');

            // Convert USDT amount to wei (assuming 6 decimals for USDT)
            const usdtAmountWei = ethers.utils.parseUnits(usdtAmount, 6);

            // Call TokenStore.buy function
            const tx = await this.contracts.tokenStore.buy(usdtAmountWei);

            this.logTransaction(`Buying ${usdtAmount} USDT worth of GT tokens...`, 'info');

            // Wait for transaction confirmation
            await tx.wait();

            // Reload balances
            await this.loadBalances();

            this.hideLoading();
            this.logTransaction(`Successfully purchased ${usdtAmount} GT tokens!`, 'success');
            this.showModal('Purchase Successful', `Successfully purchased ${usdtAmount} GT tokens!`);

        } catch (error) {
            this.hideLoading();
            console.error('Failed to buy GT:', error);
            this.logTransaction('Failed to purchase GT tokens', 'error');
            this.showModal('Purchase Failed', 'Failed to purchase GT tokens. Please try again.');
        }
    }

    async findMatch() {
        try {
            const stakeAmount = document.getElementById('stakeAmount').value;
            if (!stakeAmount || stakeAmount <= 0) {
                this.showModal('Invalid Stake', 'Please enter a valid stake amount.');
                return;
            }

            // Check GT balance
            const gtBalance = await this.contracts.gameToken.balanceOf(this.address);
            const stakeAmountWei = ethers.utils.parseUnits(stakeAmount, 18);

            if (gtBalance.lt(stakeAmountWei)) {
                this.showModal('Insufficient Balance', 'You don\'t have enough GT tokens for this stake.');
                return;
            }

            this.matchmaking = true;
            document.getElementById('matchmakingStatus').style.display = 'block';
            document.getElementById('findMatch').disabled = true;

            this.logTransaction(`Searching for match with ${stakeAmount} GT stake...`, 'info');

            // Connect to matchmaking server
            await this.connectToMatchmakingServer();

            // Send matchmaking request
            this.socket.emit('findMatch', {
                address: this.address,
                stake: stakeAmount,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('Failed to find match:', error);
            this.matchmaking = false;
            document.getElementById('matchmakingStatus').style.display = 'none';
            document.getElementById('findMatch').disabled = false;
            this.showModal('Matchmaking Failed', 'Failed to find a match. Please try again.');
        }
    }

    async connectToMatchmakingServer() {
        return new Promise((resolve, reject) => {
            this.socket = io('http://localhost:3001'); // Matchmaking server

            this.socket.on('connect', () => {
                console.log('Connected to matchmaking server');
                resolve();
            });

            this.socket.on('matchFound', async (matchData) => {
                await this.handleMatchFound(matchData);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from matchmaking server');
            });

            this.socket.on('connect_error', (error) => {
                console.error('Matchmaking connection error:', error);
                reject(error);
            });
        });
    }

    async handleMatchFound(matchData) {
        try {
            this.matchmaking = false;
            document.getElementById('matchmakingStatus').style.display = 'none';
            document.getElementById('findMatch').disabled = false;

            this.gameState.currentMatch = matchData;

            // Show stake confirmation section
            this.showStakeConfirmation(matchData);

            this.logTransaction(`Match found! Opponent ${matchData.player2.substring(0, 6)}... joined.`, 'success');

        } catch (error) {
            console.error('Failed to handle match:', error);
            this.showModal('Match Error', 'Failed to start the match. Please try again.');
        }
    }

    showStakeConfirmation(matchData) {
        // Update stake section with match details
        document.getElementById('stakeMatchId').textContent = matchData.matchId;
        document.getElementById('stakeOpponent').textContent = matchData.player2.substring(0, 6) + '...' + matchData.player2.substring(38);
        document.getElementById('stakeAmount').textContent = matchData.stake;
        document.getElementById('totalPot').textContent = matchData.stake * 2;

        // Show stake section
        this.showSection('stakeSection');
    }

    async approveAndStake() {
        try {
            const matchData = this.gameState.currentMatch;
            const stakeAmountWei = ethers.utils.parseUnits(matchData.stake.toString(), 18);

            this.showLoading('Approving and staking GT tokens...');

            // First approve PlayGame contract to spend GT tokens
            const approveTx = await this.contracts.gameToken.approve(
                this.contractAddresses.playGame,
                stakeAmountWei
            );

            this.logTransaction('Approving GT token spending...', 'info');
            await approveTx.wait();

            // Then stake tokens
            const stakeTx = await this.contracts.playGame.stake(matchData.matchId);

            this.logTransaction('Staking GT tokens...', 'info');
            await stakeTx.wait();

            // Reload balances
            await this.loadBalances();

            this.hideLoading();
            this.logTransaction('Successfully staked GT tokens!', 'success');

            // Show waiting status
            document.getElementById('stakeStatus').style.display = 'block';
            document.getElementById('stakeStatusText').textContent = 'Waiting for opponent to stake...';

            // Notify server that player has staked
            this.socket.emit('playerStaked', {
                matchId: matchData.matchId,
                address: this.address
            });

        } catch (error) {
            this.hideLoading();
            console.error('Failed to stake tokens:', error);
            this.logTransaction('Failed to stake tokens', 'error');
            this.showModal('Staking Failed', 'Failed to stake tokens. Please try again.');
        }
    }

    async cancelMatch() {
        if (confirm('Are you sure you want to cancel this match?')) {
            try {
                // Notify server
                this.socket.emit('cancelMatch', {
                    matchId: this.gameState.currentMatch.matchId,
                    address: this.address
                });

                this.logTransaction('Match cancelled', 'warning');
                this.showDashboard();

            } catch (error) {
                console.error('Failed to cancel match:', error);
            }
        }
    }

    showGame(matchData) {
        // Update game info
        document.getElementById('matchId').textContent = matchData.matchId;
        document.getElementById('matchStake').textContent = matchData.stake + ' GT';
        document.getElementById('gameTotalPot').textContent = matchData.stake * 2 + ' GT';
        document.getElementById('player1Name').textContent = matchData.player1.substring(0, 6) + '...';
        document.getElementById('player2Name').textContent = matchData.player2.substring(0, 6) + '...';

        // Reset game board
        this.resetGameBoard();

        // Show game section
        this.showSection('gameSection');
    }

    async endGame(result) {
        this.gameState.gameActive = false;

        // Disable all cells
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });

        if (result === 'WIN') {
            this.updateGameStatus('🎉 You won! 🎉');
            this.logTransaction('You won the match!', 'success');

            // Show results
            await this.showResults(result);

        } else if (result === 'LOSE') {
            this.updateGameStatus('😔 You lost!');
            this.logTransaction('You lost the match.', 'error');

            // Show results
            await this.showResults(result);

        } else if (result === 'DRAW') {
            this.updateGameStatus('🤝 It\'s a draw!');
            this.logTransaction('The match ended in a draw.', 'warning');

            // Show results
            await this.showResults(result);
        }
    }

    async showResults(result) {
        const matchData = this.gameState.currentMatch;

        // Update results section
        if (result === 'WIN') {
            document.getElementById('winnerText').textContent = '🎉 You won! Winner gets 2× stake GT!';
            document.getElementById('winnerAddress').textContent = this.address.substring(0, 6) + '...' + this.address.substring(38);
        } else if (result === 'LOSE') {
            document.getElementById('winnerText').textContent = '😔 You lost! Opponent gets 2× stake GT!';
            document.getElementById('winnerAddress').textContent = matchData.player2.substring(0, 6) + '...' + matchData.player2.substring(38);
        } else {
            document.getElementById('winnerText').textContent = '🤝 It\'s a draw! Stakes returned.';
            document.getElementById('winnerAddress').textContent = 'No winner';
        }

        document.getElementById('resultsMatchId').textContent = matchData.matchId;
        document.getElementById('resultsStake').textContent = matchData.stake + ' GT';
        document.getElementById('resultsPayout').textContent = matchData.stake * 2 + ' GT';

        // Show results section
        this.showSection('resultsSection');

        // Process blockchain transaction
        await this.processGameResult(result);
    }

    async processGameResult(result) {
        try {
            this.showLoading('Processing game result...');

            const matchData = this.gameState.currentMatch;
            const winner = result === 'WIN' ? this.address :
                result === 'LOSE' ? matchData.player2 :
                    ethers.constants.AddressZero; // Draw

            // Commit result to blockchain
            const tx = await this.contracts.playGame.commitResult(matchData.matchId, winner);

            this.logTransaction('Committing result to blockchain...', 'info');

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            this.hideLoading();

            // Update transaction status
            document.getElementById('txStatus').className = 'status-confirmed';
            document.getElementById('txStatus').innerHTML = '<span class="status-icon">✅</span><span class="status-text">Confirmed</span>';

            // Show transaction hash
            document.getElementById('txHash').style.display = 'block';
            document.getElementById('txHashLink').href = `https://etherscan.io/tx/${receipt.transactionHash}`;

            this.logTransaction(`Result committed! Transaction: ${receipt.transactionHash}`, 'success');

            // Reload balances
            await this.loadBalances();

            // Show history after a delay
            setTimeout(() => {
                this.showHistory(matchData, result, receipt.transactionHash);
            }, 3000);

        } catch (error) {
            this.hideLoading();
            console.error('Failed to commit result:', error);
            this.logTransaction('Failed to commit result', 'error');
        }
    }

    showHistory(matchData, result, txHash) {
        // Update history section
        document.getElementById('historyMatchId').textContent = matchData.matchId;
        document.getElementById('historyOpponent').textContent = matchData.player2.substring(0, 6) + '...' + matchData.player2.substring(38);
        document.getElementById('historyStake').textContent = matchData.stake + ' GT';
        document.getElementById('historyResult').textContent = result === 'WIN' ? 'Won' : result === 'LOSE' ? 'Lost' : 'Draw';
        document.getElementById('historyTxLink').href = `https://etherscan.io/tx/${txHash}`;

        // Show history section
        this.showSection('historySection');
    }

    resetGameBoard() {
        this.gameState.board = Array(9).fill('');
        this.gameState.gameActive = true;

        // Clear board
        document.querySelectorAll('.cell').forEach(cell => {
            cell.textContent = '';
            cell.classList.remove('x', 'o', 'disabled');
        });
    }

    makeMove(cell) {
        if (!this.gameState.gameActive || !this.gameState.isMyTurn) {
            return;
        }

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const index = row * 3 + col;

        if (this.gameState.board[index] !== '') {
            return; // Cell already occupied
        }

        // Make move
        this.gameState.board[index] = this.gameState.mySymbol;
        cell.textContent = this.gameState.mySymbol;
        cell.classList.add(this.gameState.mySymbol.toLowerCase());

        this.gameState.isMyTurn = false;
        this.updateGameStatus('Opponent\'s turn...');

        // Send move to server
        this.socket.emit('makeMove', {
            matchId: this.gameState.currentMatch.matchId,
            row: row,
            col: col,
            symbol: this.gameState.mySymbol
        });

        // Check for win
        if (this.checkWin(this.gameState.mySymbol)) {
            this.endGame('WIN');
        } else if (this.checkDraw()) {
            this.endGame('DRAW');
        }
    }

    checkWin(symbol) {
        const winConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
            [0, 4, 8], [2, 4, 6] // Diagonals
        ];

        return winConditions.some(condition => {
            return condition.every(index => this.gameState.board[index] === symbol);
        });
    }

    checkDraw() {
        return this.gameState.board.every(cell => cell !== '');
    }

    async endGame(result) {
        this.gameState.gameActive = false;

        // Disable all cells
        document.querySelectorAll('.cell').forEach(cell => {
            cell.classList.add('disabled');
        });

        if (result === 'WIN') {
            this.updateGameStatus('🎉 You won! 🎉');
            this.logTransaction('You won the match!', 'success');

            // Show results
            await this.showResults(result);

        } else if (result === 'LOSE') {
            this.updateGameStatus('😔 You lost!');
            this.logTransaction('You lost the match.', 'error');

            // Show results
            await this.showResults(result);

        } else if (result === 'DRAW') {
            this.updateGameStatus('🤝 It\'s a draw!');
            this.logTransaction('The match ended in a draw.', 'warning');

            // Show results
            await this.showResults(result);
        }
    }

    async showResults(result) {
        const matchData = this.gameState.currentMatch;

        // Update results section
        if (result === 'WIN') {
            document.getElementById('winnerText').textContent = '🎉 You won! Winner gets 2× stake GT!';
            document.getElementById('winnerAddress').textContent = this.address.substring(0, 6) + '...' + this.address.substring(38);
        } else if (result === 'LOSE') {
            document.getElementById('winnerText').textContent = '😔 You lost! Opponent gets 2× stake GT!';
            document.getElementById('winnerAddress').textContent = matchData.player2.substring(0, 6) + '...' + matchData.player2.substring(38);
        } else {
            document.getElementById('winnerText').textContent = '🤝 It\'s a draw! Stakes returned.';
            document.getElementById('winnerAddress').textContent = 'No winner';
        }

        document.getElementById('resultsMatchId').textContent = matchData.matchId;
        document.getElementById('resultsStake').textContent = matchData.stake + ' GT';
        document.getElementById('resultsPayout').textContent = matchData.stake * 2 + ' GT';

        // Show results section
        this.showSection('resultsSection');

        // Process blockchain transaction
        await this.processGameResult(result);
    }

    async processGameResult(result) {
        try {
            this.showLoading('Processing game result...');

            const matchData = this.gameState.currentMatch;
            const winner = result === 'WIN' ? this.address :
                result === 'LOSE' ? matchData.player2 :
                    ethers.constants.AddressZero; // Draw

            // Commit result to blockchain
            const tx = await this.contracts.playGame.commitResult(matchData.matchId, winner);

            this.logTransaction('Committing result to blockchain...', 'info');

            // Wait for transaction confirmation
            const receipt = await tx.wait();

            this.hideLoading();

            // Update transaction status
            document.getElementById('txStatus').className = 'status-confirmed';
            document.getElementById('txStatus').innerHTML = '<span class="status-icon">✅</span><span class="status-text">Confirmed</span>';

            // Show transaction hash
            document.getElementById('txHash').style.display = 'block';
            document.getElementById('txHashLink').href = `https://etherscan.io/tx/${receipt.transactionHash}`;

            this.logTransaction(`Result committed! Transaction: ${receipt.transactionHash}`, 'success');

            // Reload balances
            await this.loadBalances();

            // Show history after a delay
            setTimeout(() => {
                this.showHistory(matchData, result, receipt.transactionHash);
            }, 3000);

        } catch (error) {
            this.hideLoading();
            console.error('Failed to commit result:', error);
            this.logTransaction('Failed to commit result', 'error');
        }
    }

    showHistory(matchData, result, txHash) {
        // Update history section
        document.getElementById('historyMatchId').textContent = matchData.matchId;
        document.getElementById('historyOpponent').textContent = matchData.player2.substring(0, 6) + '...' + matchData.player2.substring(38);
        document.getElementById('historyStake').textContent = matchData.stake + ' GT';
        document.getElementById('historyResult').textContent = result === 'WIN' ? 'Won' : result === 'LOSE' ? 'Lost' : 'Draw';
        document.getElementById('historyTxLink').href = `https://etherscan.io/tx/${txHash}`;

        // Show history section
        this.showSection('historySection');
    }

    playAgain() {
        // Reset game state and go back to dashboard
        this.gameState.currentMatch = null;
        this.gameState.board = Array(9).fill('');
        this.gameState.gameActive = false;
        this.gameState.mySymbol = null;
        this.gameState.isMyTurn = false;

        this.showDashboard();
    }

    async forfeitMatch() {
        if (confirm('Are you sure you want to forfeit this match? You will lose your stake.')) {
            try {
                this.showLoading('Forfeiting match...');

                // Notify server
                this.socket.emit('forfeitMatch', {
                    matchId: this.gameState.currentMatch.matchId,
                    address: this.address
                });

                this.logTransaction('Match forfeited', 'warning');
                this.showDashboard();

            } catch (error) {
                console.error('Failed to forfeit match:', error);
            } finally {
                this.hideLoading();
            }
        }
    }

    // Section management
    showSection(sectionId) {
        // Hide all sections
        document.getElementById('connectSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('stakeSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('historySection').style.display = 'none';

        // Show requested section
        document.getElementById(sectionId).style.display = 'block';
    }

    showDashboard() {
        this.showSection('dashboardSection');
    }

    updateGameStatus(status) {
        document.getElementById('gameStatus').textContent = status;
    }

    async loadLeaderboard() {
        try {
            const response = await fetch('http://localhost:3001/leaderboard');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            const leaderboard = data.leaderboard || data; // Handle both formats

            const leaderboardElement = document.getElementById('leaderboard');
            leaderboardElement.innerHTML = '';

            if (Array.isArray(leaderboard) && leaderboard.length > 0) {
                leaderboard.forEach((player, index) => {
                    const item = document.createElement('div');
                    item.className = 'leaderboard-item';
                    item.innerHTML = `
                        <div class="rank">#${index + 1}</div>
                        <div class="player-info">
                            <div>${player.address.substring(0, 6)}...${player.address.substring(38)}</div>
                            <div class="player-stats">
                                ${player.wins}W ${player.losses}L | ${player.gtWon} GT | ${player.winRate}% Win Rate
                            </div>
                        </div>
                    `;
                    leaderboardElement.appendChild(item);
                });
            } else {
                leaderboardElement.innerHTML = '<div class="no-data">No leaderboard data available</div>';
            }

        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            document.getElementById('leaderboard').innerHTML = '<div class="error">Failed to load leaderboard</div>';
        }
    }

    logTransaction(message, type = 'info') {
        const logElement = document.getElementById('transactionLog');
        const timestamp = new Date().toLocaleTimeString();

        const logEntry = document.createElement('p');
        logEntry.className = type;
        logEntry.innerHTML = `<strong>${timestamp}</strong>: ${message}`;

        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;
    }

    showModal(title, content) {
        const modal = document.getElementById('modal');
        const modalContent = document.getElementById('modalContent');

        modalContent.innerHTML = `
            <h2>${title}</h2>
            <div class="modal-body">${content}</div>
        `;

        modal.style.display = 'flex';
    }

    closeModal() {
        document.getElementById('modal').style.display = 'none';
    }

    showLoading(message) {
        document.getElementById('loadingText').textContent = message;
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    // Section management
    showSection(sectionId) {
        // Hide all sections
        document.getElementById('connectSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('stakeSection').style.display = 'none';
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('historySection').style.display = 'none';

        // Show requested section
        document.getElementById(sectionId).style.display = 'block';
    }

    showDashboard() {
        this.showSection('dashboardSection');
    }

    playAgain() {
        // Reset game state and go back to dashboard
        this.gameState.currentMatch = null;
        this.gameState.board = Array(9).fill('');
        this.gameState.gameActive = false;
        this.gameState.mySymbol = null;
        this.gameState.isMyTurn = false;

        this.showDashboard();
    }

    async forfeitMatch() {
        if (confirm('Are you sure you want to forfeit this match? You will lose your stake.')) {
            try {
                this.showLoading('Forfeiting match...');

                // Notify server
                this.socket.emit('forfeitMatch', {
                    matchId: this.gameState.currentMatch.matchId,
                    address: this.address
                });

                this.logTransaction('Match forfeited', 'warning');
                this.showDashboard();

            } catch (error) {
                console.error('Failed to forfeit match:', error);
            } finally {
                this.hideLoading();
            }
        }
    }

    disconnectWallet() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.contracts = {};

        document.getElementById('walletInfo').style.display = 'none';
        this.showSection('connectSection');
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.triXTicTacToe = new TriXTicTacToe();
});
