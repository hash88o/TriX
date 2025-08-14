const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { ethers } = require('ethers');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["https://frontend-trix.vercel.app", "http://localhost:8080"],
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/1NFhV9cMA4vShirJHIwX2";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;

// Contract addresses
const CONTRACT_ADDRESSES = {
    GAME_TOKEN: process.env.GAMETOKEN_ADDR || "0x7740aF6224458cd62CEDC93f3E47735d3628Aa23",
    TOKEN_STORE: process.env.TOKENSTORE_ADDR || "0x574c85CBB55533f75894613D1869AC0EBC515156",
    PLAY_GAME: process.env.PLAYGAME_ADDR || "0xa3eE2EF1A305105445006E97d970443A063E76DD",
    MOCK_USDT: process.env.MOCKUSDT_ADDR || "0x9620fEfD83D6038f80148A686E3258C2E15dEE96"
};

// Initialize blockchain
let provider, signer, contracts;

async function initializeBlockchain() {
    try {
        provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        signer = new ethers.Wallet(PRIVATE_KEY, provider);

        // Basic contract ABIs (you can expand these)
        const gameTokenABI = [
            "function balanceOf(address) view returns (uint256)",
            "function approve(address,uint256) returns (bool)",
            "function transfer(address,uint256) returns (bool)"
        ];

        const playGameABI = [
            "function createMatch(bytes32,address,address,uint256) external",
            "function stake(bytes32) external",
            "function commitResult(bytes32,address) external",
            "function getMatch(bytes32) view returns (tuple(bytes32,address,address,uint256,uint8,uint256,bool,bool))"
        ];

        const tokenStoreABI = [
            "function buy(uint256) external",
            "function getGTAmount(uint256) view returns (uint256)"
        ];

        contracts = {
            gameToken: new ethers.Contract(CONTRACT_ADDRESSES.GAME_TOKEN, gameTokenABI, signer),
            playGame: new ethers.Contract(CONTRACT_ADDRESSES.PLAY_GAME, playGameABI, signer),
            tokenStore: new ethers.Contract(CONTRACT_ADDRESSES.TOKEN_STORE, tokenStoreABI, signer)
        };

        console.log("✅ Blockchain initialized successfully");
    } catch (error) {
        console.error("❌ Blockchain initialization failed:", error);
    }
}

// Initialize blockchain on startup
initializeBlockchain();

// ==================== EXPRESS API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        contracts: CONTRACT_ADDRESSES,
        network: 'sepolia',
        websocket: 'enabled'
    });
});

// Get balances
app.get('/balances/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!provider) {
            return res.status(500).json({ error: "Blockchain not initialized" });
        }

        const ethBalance = await provider.getBalance(address);
        const gtBalance = await contracts.gameToken.balanceOf(address);

        res.json({
            eth: ethers.formatEther(ethBalance),
            gt: ethers.formatEther(gtBalance)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buy GT with USDT
app.post('/buy-gt', async (req, res) => {
    try {
        const { amount, address } = req.body;

        if (!contracts.tokenStore) {
            return res.status(500).json({ error: "Token store not available" });
        }

        const amountWei = ethers.parseEther(amount.toString());
        const tx = await contracts.tokenStore.buy(amountWei);
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            message: `Successfully bought ${amount} GT`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// USDT faucet
app.post('/faucet', async (req, res) => {
    try {
        const { address } = req.body;

        // Mock faucet - in production you'd implement actual USDT minting
        res.json({
            success: true,
            message: `Sent 100 USDT to ${address}`,
            note: "Mock faucet - implement actual USDT minting for production"
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Match operations
app.post("/match/start", async (req, res) => {
    try {
        const { p1, p2, stake, matchId } = req.body;
        console.log("🎮 Received match creation request:", req.body);

        if (!p1 || !p2 || !stake || !matchId) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const tx = await contracts.playGame.createMatch(
            ethers.keccak256(ethers.solidityPacked(["string"], [matchId])),
            p1,
            p2,
            ethers.parseUnits(String(stake), 18)
        );

        const receipt = await tx.wait();
        console.log("✅ Match created:", matchId, receipt.transactionHash);

        res.json({
            success: true,
            matchId: receipt.transactionHash,
            message: `Match created successfully! Players: ${p1} vs ${p2}, Stake: ${stake} GT each`,
        });
    } catch (error) {
        console.error("❌ Match creation failed:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/match/result", async (req, res) => {
    try {
        const { matchId, winner } = req.body;

        if (!matchId || !winner) {
            return res.status(400).json({ error: "Missing matchId or winner" });
        }

        const tx = await contracts.playGame.commitResult(
            ethers.keccak256(ethers.solidityPacked(["string"], [matchId])),
            winner
        );

        const receipt = await tx.wait();
        console.log("✅ Match result submitted:", matchId, receipt.transactionHash);

        res.json({
            success: true,
            txHash: receipt.transactionHash,
            message: `Match result submitted! Winner: ${winner}`
        });
    } catch (error) {
        console.error("❌ Match result submission failed:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== WEBSOCKET MATCHMAKING ====================

// Game state storage
let waitingPlayers = new Map();
let activeMatches = new Map();
let playerSessions = new Map();

io.on('connection', (socket) => {
    console.log(`🔌 Player connected: ${socket.id}`);

    // Player joins matchmaking
    socket.on('findMatch', (data) => {
        const { address, stake } = data;
        console.log(`🎮 Player ${address} waiting for match with stake ${stake}`);

        // Store player session
        playerSessions.set(address, socket.id);

        // Check if there's a waiting player with same stake
        let matchFound = false;
        let opponent = null;

        for (const [waitingAddress, waitingData] of waitingPlayers) {
            if (waitingAddress !== address && waitingData.stake === stake) {
                matchFound = true;
                opponent = waitingAddress;
                break;
            }
        }

        if (matchFound) {
            // Create match
            const matchId = uuidv4();
            const matchData = {
                matchId,
                player1: opponent,
                player2: address,
                stake,
                status: 'CREATED',
                board: Array(9).fill(''),
                currentPlayer: 'X',
                gameActive: false,
                player1Staked: false,
                player2Staked: false,
                moves: [],
                player1SocketId: playerSessions.get(opponent),
                player2SocketId: socket.id
            };

            activeMatches.set(matchId, matchData);
            waitingPlayers.delete(opponent);

            // Notify both players
            io.to(playerSessions.get(opponent)).emit('matchFound', matchData);
            io.to(socket.id).emit('matchFound', matchData);

            console.log(`🎮 Match created: ${matchId} between ${opponent} and ${address} with stake ${stake}`);
        } else {
            // Add to waiting list
            waitingPlayers.set(address, {
                stake,
                timestamp: Date.now(),
                socketId: socket.id
            });

            socket.emit('waitingForMatch', { message: "Waiting for opponent..." });
        }
    });

    // Player stakes in match
    socket.on('playerStaked', (data) => {
        const { matchId, address } = data;
        const match = activeMatches.get(matchId);

        if (!match) return;

        if (match.player1 === address) {
            match.player1Staked = true;
        } else if (match.player2 === address) {
            match.player2Staked = true;
        }

        // Check if both players have staked
        if (match.player1Staked && match.player2Staked) {
            match.gameActive = true;

            // Start game
            io.to(match.player1SocketId).emit('gameStart', {
                matchId,
                symbol: 'X',
                isFirst: true
            });

            io.to(match.player2SocketId).emit('gameStart', {
                matchId,
                symbol: 'O',
                isFirst: false
            });

            console.log(`🎮 Both players staked! Starting game for match ${matchId}`);
        }
    });

    // Player makes a move
    socket.on('makeMove', (data) => {
        const { matchId, row, col, symbol } = data;
        const match = activeMatches.get(matchId);

        if (!match || !match.gameActive) return;

        // Validate move
        const index = row * 3 + col;
        if (match.board[index] !== '') return;

        // Make move
        match.board[index] = symbol;
        match.moves.push({ row, col, symbol });

        // Check for win
        const isWin = checkWin(match.board, symbol);
        if (isWin) {
            endGame(matchId, symbol);
        } else if (checkDraw(match.board)) {
            endGame(matchId, 'DRAW');
        } else {
            // Switch turns
            match.currentPlayer = match.currentPlayer === 'X' ? 'O' : 'X';

            // Notify both players
            io.to(match.player1SocketId).emit('moveMade', {
                row, col, symbol, nextPlayer: match.currentPlayer
            });
            io.to(match.player2SocketId).emit('moveMade', {
                row, col, symbol, nextPlayer: match.currentPlayer
            });
        }
    });

    // Cancel matchmaking
    socket.on('cancelMatchmaking', (data) => {
        const { address } = data;
        if (waitingPlayers.has(address)) {
            waitingPlayers.delete(address);
            socket.emit('matchmakingCancelled', { message: "Matchmaking cancelled" });
        }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
        console.log(`🔌 Player disconnected: ${socket.id}`);

        // Remove from waiting list if they were waiting
        for (const [address, data] of waitingPlayers) {
            if (data.socketId === socket.id) {
                waitingPlayers.delete(address);
                break;
            }
        }

        // Remove from player sessions
        for (const [address, socketId] of playerSessions) {
            if (socketId === socket.id) {
                playerSessions.delete(address);
                break;
            }
        }
    });
});

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

function endGame(matchId, result) {
    const match = activeMatches.get(matchId);
    if (!match) return;

    match.gameActive = false;
    match.result = result;

    // Notify both players
    io.to(match.player1SocketId).emit('gameEnded', { matchId, result });
    io.to(match.player2SocketId).emit('gameEnded', { matchId, result });

    console.log(`🎮 Game ended: ${matchId} - Result: ${result}`);
}

// Stats endpoint
app.get('/stats', (req, res) => {
    res.json({
        waitingPlayers: waitingPlayers.size,
        activeMatches: activeMatches.size,
        connectedPlayers: playerSessions.size,
        totalPlayers: waitingPlayers.size + (activeMatches.size * 2)
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 TriX Backend Server running on port ${PORT}`);
    console.log(`🌐 API: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log(`📊 Stats: http://localhost:${PORT}/stats`);
});
