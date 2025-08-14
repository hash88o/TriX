const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// Serve static files from web directory
app.use(express.static(path.join(__dirname, 'web')));

// Game state for matchmaking
const waitingPlayers = new Map(); // stake -> [players]
const activeMatches = new Map(); // matchId -> matchData
const playerSessions = new Map(); // socketId -> playerData

// Proxy API requests to TriX backend
app.use('/api/*', async (req, res) => {
    try {
        const targetUrl = `http://localhost:3000${req.url.replace('/api', '')}`;
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        console.error('API proxy error:', error);
        res.status(500).json({ error: 'API proxy error' });
    }
});

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
            stakedPlayers: new Set(),
            moves: []
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

    // Handle matchmaking request
    socket.on('findMatch', (playerData) => {
        playerData.socketId = socket.id;
        const match = findMatch(playerData);

        if (match) {
            // Match found, both players notified
        } else {
            // Player added to waiting queue
            socket.emit('matchmakingStatus', { status: 'waiting', message: 'Searching for opponent...' });
        }
    });

    // Handle player staking
    socket.on('playerStaked', (data) => {
        const { matchId, address } = data;
        const match = activeMatches.get(matchId);

        if (match) {
            match.stakedPlayers.add(address);

            // Check if both players have staked
            if (match.stakedPlayers.size === 2) {
                match.status = 'STAKED';
                match.gameActive = true;

                // Notify both players that game can start
                const player1Socket = Array.from(playerSessions.values())
                    .find(s => s.address === match.player1);
                const player2Socket = Array.from(playerSessions.values())
                    .find(s => s.address === match.player2);

                if (player1Socket) {
                    player1Socket.emit('bothStaked', match);
                }

                if (player2Socket) {
                    player2Socket.emit('bothStaked', match);
                }

                console.log(`Both players staked: ${matchId}`);
            }
        }
    });

    // Handle game moves
    socket.on('makeMove', (data) => {
        const { matchId, index, symbol, board } = data;
        const match = activeMatches.get(matchId);

        if (match && match.gameActive) {
            // Update match state
            match.board = board;
            match.moves.push({ index, symbol, timestamp: Date.now() });

            // Forward move to opponent
            const opponentSocket = Array.from(playerSessions.values())
                .find(s => s.address !== data.address &&
                    (s.address === match.player1 || s.address === match.player2));

            if (opponentSocket) {
                opponentSocket.emit('opponentMove', { index, symbol, board });
            }
        }
    });

    // Handle match cancellation
    socket.on('cancelMatch', (data) => {
        const { matchId } = data;
        if (matchId && activeMatches.has(matchId)) {
            activeMatches.delete(matchId);
        }
    });

    // Handle forfeit
    socket.on('forfeitMatch', (data) => {
        const { matchId, address } = data;
        const match = activeMatches.get(matchId);

        if (match) {
            match.gameActive = false;
            const winner = match.player1 === address ? match.player2 : match.player1;

            // Notify opponent of forfeit
            const opponentSocket = Array.from(playerSessions.values())
                .find(s => s.address === winner);

            if (opponentSocket) {
                opponentSocket.emit('gameEnd', {
                    result: 'WIN',
                    reason: 'FORFEIT',
                    winner
                });
            }

            activeMatches.delete(matchId);
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

        // Handle active matches
        for (const [matchId, match] of activeMatches.entries()) {
            if (match.player1 === socket.address || match.player2 === socket.address) {
                // Handle disconnect/forfeit
                const winner = match.player1 === socket.address ? match.player2 : match.player1;

                const opponentSocket = Array.from(playerSessions.values())
                    .find(s => s.address === winner);

                if (opponentSocket) {
                    opponentSocket.emit('gameEnd', {
                        result: 'WIN',
                        reason: 'DISCONNECT',
                        winner
                    });
                }

                activeMatches.delete(matchId);
                break;
            }
        }

        playerSessions.delete(socket.id);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        waitingPlayers: waitingPlayers.size,
        activeMatches: activeMatches.size
    });
});

// Stats endpoint
app.get('/stats', (req, res) => {
    res.json({
        waitingPlayers: waitingPlayers.size,
        activeMatches: activeMatches.size,
        connectedPlayers: playerSessions.size
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`🎮 TriX Gaming Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Stats: http://localhost:${PORT}/stats`);
});
