const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Game state
const waitingPlayers = new Map(); // stake -> [players]
const activeMatches = new Map(); // matchId -> matchData
const playerSessions = new Map(); // socketId -> playerData
const preStakedPlayers = new Map(); // address -> {stake, timestamp, socketId}

// Timeout for refunding pre-staked amounts (5 minutes)
const PRE_STAKE_TIMEOUT = 5 * 60 * 1000;

// Matchmaking logic
function findMatch(playerData) {
    const { address, stake } = playerData;

    // Check if there's a waiting player with the same stake
    if (waitingPlayers.has(stake)) {
        const waitingPlayer = waitingPlayers.get(stake).shift();

        // If no more waiting players for this stake, remove the entry
        if (waitingPlayers.get(stake).length === 0) {
            waitingPlayers.delete(stake);
        }

        // Create match
        const matchId = uuidv4();
        const matchData = {
            matchId,
            player1: waitingPlayer.address,
            player2: address,
            stake: parseInt(stake),
            status: 'CREATED',
            board: Array(9).fill(''),
            currentPlayer: 'X',
            gameActive: false,
            player1Staked: false,
            player2Staked: false,
            blockchainMatchId: null,
            moves: [],
            player1SocketId: waitingPlayer.socketId,
            player2SocketId: playerData.socketId
        };

        activeMatches.set(matchId, matchData);

        // Notify both players
        const waitingSocket = playerSessions.get(waitingPlayer.socketId);
        const currentSocket = playerSessions.get(playerData.socketId);

        if (waitingSocket) {
            waitingSocket.emit('matchFound', matchData);
        }

        if (currentSocket) {
            currentSocket.emit('matchFound', matchData);
        }

        console.log(`Match created: ${matchId} between ${waitingPlayer.address} and ${address} with stake ${stake}`);

        return matchData;
    } else {
        // Add player to waiting queue
        if (!waitingPlayers.has(stake)) {
            waitingPlayers.set(stake, []);
        }
        waitingPlayers.get(stake).push(playerData);

        console.log(`Player ${address} waiting for match with stake ${stake}`);
        return null;
    }
}

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Store player session
    playerSessions.set(socket.id, socket);

    // Handle pre-staking and matchmaking request
    socket.on('findMatch', async (playerData) => {
        try {
            const { address, stake } = playerData;

            // Check if player already has a pre-stake
            if (preStakedPlayers.has(address)) {
                socket.emit('matchmakingStatus', {
                    status: 'error',
                    message: 'You already have a pending stake. Please wait or cancel.'
                });
                return;
            }

            // Store pre-stake info
            preStakedPlayers.set(address, {
                stake: parseInt(stake),
                timestamp: Date.now(),
                socketId: socket.id
            });

            // Add to waiting queue
            playerData.socketId = socket.id;
            const match = findMatch(playerData);

            if (match) {
                // Match found, both players notified
                socket.emit('matchmakingStatus', {
                    status: 'matched',
                    message: 'Opponent found! Creating match...'
                });
            } else {
                // Player added to waiting queue
                socket.emit('matchmakingStatus', {
                    status: 'waiting',
                    message: 'Searching for opponent... Your stake is held in escrow.'
                });
            }
        } catch (error) {
            console.error('Error in findMatch:', error);
            socket.emit('matchmakingStatus', {
                status: 'error',
                message: 'Failed to start matchmaking: ' + error.message
            });
        }
    });

    // Handle pre-stake confirmation (when player has already staked on-chain)
    socket.on('preStakeConfirmed', (data) => {
        const { address, stake } = data;

        // Update pre-stake info to mark as confirmed
        if (preStakedPlayers.has(address)) {
            const preStake = preStakedPlayers.get(address);
            preStake.confirmed = true;
            preStake.blockchainMatchId = data.blockchainMatchId;
        }
    });

    // Handle match creation (when Player 1 creates and stakes)
    socket.on('matchCreated', (data) => {
        const { matchId, player1, player2, stake, playerStaked, blockchainMatchId } = data;
        const match = activeMatches.get(matchId);

        if (match) {
            match.blockchainMatchId = blockchainMatchId;

            // Mark that Player 1 has staked
            if (playerStaked.toLowerCase() === match.player1.toLowerCase()) {
                match.player1Staked = true;
                console.log(`✅ Player 1 (${playerStaked}) has staked in match ${matchId}`);
            }
        }
    });

    // Handle notification to Player 2 (broadcast that match is created)
    socket.on('notifyPlayer2', (data) => {
        console.log(`🎮 Notifying Player 2 about match created on-chain: ${data.matchId}`);

        // Broadcast to the other player that match is created and they can stake
        socket.broadcast.emit('matchCreatedOnChain', {
            matchId: data.matchId,
            blockchainMatchId: data.blockchainMatchId,
            createdBy: data.createdBy
        });
    });

    // Handle player staking confirmation (when Player 2 stakes)
    socket.on('playerStaked', (data) => {
        console.log(`💰 Player staked: ${data.player} in match ${data.matchId}`);

        const match = activeMatches.get(data.matchId);
        if (match) {
            // Mark that Player 2 has staked
            if (data.player.toLowerCase() === match.player2.toLowerCase()) {
                match.player2Staked = true;
                console.log(`✅ Player 2 (${data.player}) has staked in match ${data.matchId}`);
            }

            // Check if both players have staked
            if (match.player1Staked && match.player2Staked) {
                console.log(`🎮 Both players staked! Starting game for match ${data.matchId}`);

                match.status = 'STAKED';
                match.gameActive = true;

                // Get player sockets
                const player1Socket = playerSessions.get(match.player1SocketId);
                const player2Socket = playerSessions.get(match.player2SocketId);

                if (player1Socket) {
                    player1Socket.emit('gameStart', {
                        matchId: data.matchId,
                        symbol: 'X',
                        isFirst: true
                    });
                }

                if (player2Socket) {
                    player2Socket.emit('gameStart', {
                        matchId: data.matchId,
                        symbol: 'O',
                        isFirst: false
                    });
                }

                console.log(`🎮 Game started: ${data.matchId} with blockchain match: ${data.blockchainMatchId}`);
            }
        }
    });

    // Handle cancel matchmaking (refund pre-stake)
    socket.on('cancelMatchmaking', (data) => {
        const { address } = data;

        if (preStakedPlayers.has(address)) {
            preStakedPlayers.delete(address);

            // Remove from waiting queue
            for (const [stake, players] of waitingPlayers.entries()) {
                const index = players.findIndex(p => p.address === address);
                if (index !== -1) {
                    players.splice(index, 1);
                    if (players.length === 0) {
                        waitingPlayers.delete(stake);
                    }
                    break;
                }
            }

            socket.emit('matchmakingStatus', {
                status: 'cancelled',
                message: 'Matchmaking cancelled. Your stake will be refunded.'
            });
        }
    });

    // Handle game moves
    socket.on('makeMove', (data) => {
        const { matchId, row, col, symbol } = data;
        const match = activeMatches.get(matchId);

        if (match && match.gameActive) {
            const index = row * 3 + col;

            // Validate move
            if (match.board[index] === '') {
                match.board[index] = symbol;
                match.moves.push({ row, col, symbol });

                // Check for win
                const isWin = checkWin(match.board, symbol);
                if (isWin) {
                    endGame(matchId, symbol); // Pass the winning symbol, not boolean
                } else if (checkDraw(match.board)) {
                    endGame(matchId, 'DRAW');
                } else {
                    // Switch turns
                    match.currentPlayer = match.currentPlayer === 'X' ? 'O' : 'X';

                    // Notify both players
                    notifyPlayers(matchId, 'moveMade', { row, col, symbol, nextPlayer: match.currentPlayer });
                }
            }
        }
    });

    // Handle forfeit
    socket.on('forfeitMatch', (data) => {
        const { matchId, address } = data;
        const match = activeMatches.get(matchId);

        if (match) {
            const winner = address === match.player1 ? match.player2 : match.player1;
            endGame(matchId, winner, 'FORFEIT');
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);

        // Remove from waiting queue if applicable
        for (const [stake, players] of waitingPlayers.entries()) {
            const index = players.findIndex(p => p.socketId === socket.id);
            if (index !== -1) {
                players.splice(index, 1);
                if (players.length === 0) {
                    waitingPlayers.delete(stake);
                }
                break;
            }
        }

        // Remove from active matches if applicable
        for (const [matchId, match] of activeMatches.entries()) {
            if (match.player1SocketId === socket.id || match.player2SocketId === socket.id) {
                // Handle forfeit
                const winner = match.player1SocketId === socket.id ? match.player2 : match.player1;
                endGame(matchId, winner, 'DISCONNECT');
                break;
            }
        }

        // Remove pre-stake if applicable
        for (const [address, preStake] of preStakedPlayers.entries()) {
            if (preStake.socketId === socket.id) {
                preStakedPlayers.delete(address);
                break;
            }
        }

        playerSessions.delete(socket.id);
    });
});

// Game logic functions
function checkWin(board, symbol) {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    const hasWon = winConditions.some(condition => {
        return condition.every(index => board[index] === symbol);
    });

    console.log(`🔍 Checking win for ${symbol}:`, board, 'Result:', hasWon);
    return hasWon;
}

function checkDraw(board) {
    return board.every(cell => cell !== '');
}

function endGame(matchId, result, reason = 'NORMAL') {
    const match = activeMatches.get(matchId);
    if (!match) return;

    match.status = 'COMPLETED';
    match.gameActive = false;
    match.result = result;
    match.endReason = reason;

    // Determine winner address
    let winnerAddress;
    if (result === 'X') {
        winnerAddress = match.player1;
    } else if (result === 'O') {
        winnerAddress = match.player2;
    } else {
        winnerAddress = null; // Draw
    }

    // Notify both players
    notifyPlayers(matchId, 'gameEnd', {
        winner: result,
        winnerAddress,
        reason,
        finalBoard: match.board
    });

    console.log(`Game ended: ${matchId} - Winner: ${result}`);

    // Clean up after some time
    setTimeout(() => {
        activeMatches.delete(matchId);
    }, 60000); // 1 minute
}

function notifyPlayers(matchId, event, data) {
    const match = activeMatches.get(matchId);
    if (!match) return;

    const player1Socket = playerSessions.get(match.player1SocketId);
    const player2Socket = playerSessions.get(match.player2SocketId);

    if (player1Socket) {
        player1Socket.emit(event, data);
    }

    if (player2Socket) {
        player2Socket.emit(event, data);
    }
}

// Clean up expired pre-stakes
setInterval(() => {
    const now = Date.now();
    for (const [address, preStake] of preStakedPlayers.entries()) {
        if (now - preStake.timestamp > PRE_STAKE_TIMEOUT) {
            console.log(`Pre-stake expired for ${address}, removing from queue`);
            preStakedPlayers.delete(address);

            // Remove from waiting queue
            for (const [stake, players] of waitingPlayers.entries()) {
                const index = players.findIndex(p => p.address === address);
                if (index !== -1) {
                    players.splice(index, 1);
                    if (players.length === 0) {
                        waitingPlayers.delete(stake);
                    }
                    break;
                }
            }
        }
    }
}, 30000); // Check every 30 seconds

// API endpoints
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/stats', (req, res) => {
    res.json({
        waitingPlayers: Array.from(waitingPlayers.entries()).map(([stake, players]) => ({
            stake,
            count: players.length
        })),
        activeMatches: activeMatches.size,
        connectedPlayers: playerSessions.size,
        preStakedPlayers: preStakedPlayers.size
    });
});

app.get('/matches/:matchId', (req, res) => {
    const match = activeMatches.get(req.params.matchId);
    if (match) {
        res.json(match);
    } else {
        res.status(404).json({ error: 'Match not found' });
    }
});

// Mock leaderboard endpoint
app.get('/leaderboard', (req, res) => {
    const leaderboard = [
        {
            address: '0x1234567890123456789012345678901234567890',
            wins: 15,
            losses: 3,
            draws: 2,
            totalGTWon: 300
        },
        {
            address: '0x0987654321098765432109876543210987654321',
            wins: 12,
            losses: 5,
            draws: 3,
            totalGTWon: 240
        },
        {
            address: '0xabcdef1234567890abcdef1234567890abcdef12',
            wins: 8,
            losses: 7,
            draws: 5,
            totalGTWon: 160
        }
    ];

    res.json(leaderboard);
});

// Start server
const PORT = process.env.MATCHMAKING_PORT || 3002;
server.listen(PORT, () => {
    console.log(`🎮 TriX Matchmaking Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/stats`);
    console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard`);
});

module.exports = { app, io, activeMatches, waitingPlayers };
