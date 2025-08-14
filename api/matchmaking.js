const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

// In-memory storage for serverless environment
const waitingPlayers = new Map();
const activeMatches = new Map();
const preStakedPlayers = new Map();

const PRE_STAKE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Matchmaking logic
function findMatch(playerData) {
    const { address, stake } = playerData;

    if (waitingPlayers.has(stake)) {
        const waitingPlayer = waitingPlayers.get(stake).shift();

        if (waitingPlayers.get(stake).length === 0) {
            waitingPlayers.delete(stake);
        }

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
            moves: [],
            player1SocketId: waitingPlayer.socketId,
            player2SocketId: playerData.socketId
        };

        activeMatches.set(matchId, matchData);
        return matchData;
    } else {
        if (!waitingPlayers.has(stake)) {
            waitingPlayers.set(stake, []);
        }
        waitingPlayers.get(stake).push(playerData);
        return null;
    }
}

// Game logic functions
function checkWin(board, symbol) {
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
        [0, 4, 8], [2, 4, 6] // Diagonals
    ];

    return winConditions.some(condition => {
        return condition.every(index => board[index] === symbol);
    });
}

function checkDraw(board) {
    return board.every(cell => cell !== '');
}

// Vercel serverless function handler
module.exports = (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { method, path } = req;

    // Health check
    if (method === 'GET' && path === '/health') {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            waitingPlayers: Array.from(waitingPlayers.entries()).map(([stake, players]) => ({
                stake,
                count: players.length
            })),
            activeMatches: activeMatches.size,
            preStakedPlayers: preStakedPlayers.size
        });
        return;
    }

    // Stats endpoint
    if (method === 'GET' && path === '/stats') {
        res.json({
            waitingPlayers: Array.from(waitingPlayers.entries()).map(([stake, players]) => ({
                stake,
                count: players.length
            })),
            activeMatches: activeMatches.size,
            preStakedPlayers: preStakedPlayers.size
        });
        return;
    }

    // Mock leaderboard endpoint
    if (method === 'GET' && path === '/leaderboard') {
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
        return;
    }

    // Handle WebSocket upgrade (for real-time matchmaking)
    if (method === 'GET' && path === '/socket.io/') {
        // This would need to be handled by a WebSocket service
        // For now, we'll return a message indicating WebSocket is not available
        res.status(400).json({
            error: 'WebSocket connections not supported in serverless environment',
            message: 'Please use the API endpoints for matchmaking'
        });
        return;
    }

    // Default response
    res.status(404).json({
        error: 'Endpoint not found',
        availableEndpoints: [
            'GET /health',
            'GET /stats',
            'GET /leaderboard'
        ]
    });
};
