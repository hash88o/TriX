const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.LEADERBOARD_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (in production, use PostgreSQL/MongoDB)
let events = [];
let playerStats = {};
let purchaseStats = {};

// Global variables
let provider;
let contracts = {};

// Contract ABIs
const ABIS = {
    ERC20: [
        "function balanceOf(address) view returns (uint256)",
        "event Transfer(address indexed,address indexed,uint256)"
    ],
    TokenStore: [
        "event Purchase(address indexed,uint256,uint256)"
    ],
    PlayGame: [
        "event MatchCreated(bytes32 indexed,address indexed,address indexed,uint256)",
        "event Staked(bytes32 indexed,address indexed,uint256)",
        "event Settled(bytes32 indexed,address indexed,uint256)",
        "event Refunded(bytes32 indexed,address indexed,uint256)",
        "function getMatch(bytes32) view returns (tuple(bytes32,address,address,uint256,uint8,uint256,bool,bool))"
    ]
};

// Initialize blockchain connection and start listening
async function initialize() {
    try {
        console.log('🚀 Starting TriX Leaderboard Service...');

        // Connect to network
        const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
        provider = new ethers.JsonRpcProvider(rpcUrl);

        console.log('🔗 Connected to blockchain');

        // Initialize contracts
        contracts.gameToken = new ethers.Contract(
            process.env.GAMETOKEN_ADDR,
            ABIS.ERC20,
            provider
        );

        contracts.tokenStore = new ethers.Contract(
            process.env.TOKENSTORE_ADDR,
            ABIS.TokenStore,
            provider
        );

        contracts.playGame = new ethers.Contract(
            process.env.PLAYGAME_ADDR,
            ABIS.PlayGame,
            provider
        );

        console.log('🎮 Contracts initialized');

        // Start event listeners
        startEventListeners();

        console.log('👂 Event listeners started');
        console.log('✅ Leaderboard service initialization complete');

    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        throw error;
    }
}

// Start listening to blockchain events
function startEventListeners() {
    // Listen to TokenStore purchase events
    contracts.tokenStore.on('Purchase', (buyer, usdtAmount, gtOut) => {
        const event = {
            type: 'Purchase',
            buyer,
            usdtAmount: ethers.formatUnits(usdtAmount, 6),
            gtAmount: ethers.formatEther(gtOut),
            timestamp: new Date().toISOString(),
            txHash: 'pending' // Would be filled in real implementation
        };

        events.unshift(event);
        updatePurchaseStats(buyer, parseFloat(event.usdtAmount), parseFloat(event.gtAmount));

        console.log('💰 Purchase:', event);
    });

    // Listen to PlayGame match creation events
    contracts.playGame.on('MatchCreated', (matchId, player1, player2, stakeAmount) => {
        const event = {
            type: 'MatchCreated',
            matchId: matchId,
            player1,
            player2,
            stakeAmount: ethers.formatEther(stakeAmount),
            timestamp: new Date().toISOString(),
            txHash: 'pending'
        };

        events.unshift(event);
        initializePlayerStats(player1);
        initializePlayerStats(player2);

        console.log('🎮 Match Created:', event);
    });

    // Listen to PlayGame staking events
    contracts.playGame.on('Staked', (matchId, player, amount) => {
        const event = {
            type: 'Staked',
            matchId: matchId,
            player,
            amount: ethers.formatEther(amount),
            timestamp: new Date().toISOString(),
            txHash: 'pending'
        };

        events.unshift(event);
        initializePlayerStats(player);

        console.log('💰 Staked:', event);
    });

    // Listen to PlayGame settlement events
    contracts.playGame.on('Settled', async (matchId, winner, payout) => {
        try {
            // Get match details to find the loser
            const match = await contracts.playGame.getMatch(matchId);
            const loser = winner.toLowerCase() === match[1].toLowerCase() ? match[2] : match[1];
            const stakeAmount = parseFloat(ethers.formatEther(match[3]));
            const winnerPayout = parseFloat(ethers.formatEther(payout));

            const event = {
                type: 'Settled',
                matchId: matchId.toString(),
                winner,
                loser,
                stakeAmount,
                payout: winnerPayout,
                timestamp: new Date().toISOString(),
                txHash: 'pending'
            };

            events.unshift(event);
            updatePlayerStats(winner, loser, stakeAmount, winnerPayout);

            console.log('🏆 Match Settled:', event);
        } catch (error) {
            console.error('Error processing match completion:', error);
        }
    });

    // Listen to match cancellation events
    contracts.playGame.on('MatchCancelled', (matchId, player1, player2) => {
        const event = {
            type: 'Cancelled',
            matchId: matchId.toString(),
            player1,
            player2,
            timestamp: new Date().toISOString(),
            txHash: 'pending'
        };

        events.unshift(event);

        console.log('❌ Match Cancelled:', event);
    });

    // Listen to refund events
    contracts.playGame.on('Refunded', (matchId, player, amount) => {
        const event = {
            type: 'Refunded',
            matchId: matchId,
            player,
            amount: ethers.formatEther(amount),
            timestamp: new Date().toISOString(),
            txHash: 'pending'
        };

        events.unshift(event);

        console.log('💸 Refunded:', event);
    });

    // Keep only last 1000 events in memory
    setInterval(() => {
        if (events.length > 1000) {
            events = events.slice(0, 1000);
        }
    }, 60000); // Clean up every minute
}

// Update player statistics
function updatePlayerStats(winner, loser, stakeAmount, winnerPayout) {
    // Initialize players if they don't exist
    initializePlayerStats(winner);
    initializePlayerStats(loser);

    // Update winner stats
    playerStats[winner].wins++;
    playerStats[winner].gtWon += winnerPayout;
    playerStats[winner].totalMatches++;

    // Update loser stats
    playerStats[loser].losses++;
    playerStats[loser].gtLost += stakeAmount;
    playerStats[loser].totalMatches++;

    // Calculate win rates
    playerStats[winner].winRate = (playerStats[winner].wins / playerStats[winner].totalMatches) * 100;
    playerStats[loser].winRate = (playerStats[loser].wins / playerStats[loser].totalMatches) * 100;
}

// Initialize player stats
function initializePlayerStats(address) {
    if (!playerStats[address]) {
        playerStats[address] = {
            address,
            wins: 0,
            losses: 0,
            totalMatches: 0,
            gtWon: 0,
            gtLost: 0,
            winRate: 0,
            totalPurchased: 0,
            usdtSpent: 0
        };
    }
}

// Update purchase statistics
function updatePurchaseStats(buyer, usdtAmount, gtAmount) {
    initializePlayerStats(buyer);

    if (!purchaseStats[buyer]) {
        purchaseStats[buyer] = {
            address: buyer,
            totalPurchases: 0,
            totalUSDTSpent: 0,
            totalGTReceived: 0,
            firstPurchase: new Date().toISOString(),
            lastPurchase: new Date().toISOString()
        };
    }

    purchaseStats[buyer].totalPurchases++;
    purchaseStats[buyer].totalUSDTSpent += usdtAmount;
    purchaseStats[buyer].totalGTReceived += gtAmount;
    purchaseStats[buyer].lastPurchase = new Date().toISOString();

    // Also update player stats
    playerStats[buyer].totalPurchased += gtAmount;
    playerStats[buyer].usdtSpent += usdtAmount;
}

// ========== API ROUTES ==========

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        eventsCount: events.length,
        playersCount: Object.keys(playerStats).length,
        purchasersCount: Object.keys(purchaseStats).length
    });
});

// Get leaderboard (top players by GT won)
app.get('/leaderboard', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const sortedPlayers = Object.values(playerStats)
            .filter(player => player.totalMatches > 0)
            .sort((a, b) => b.gtWon - a.gtWon)
            .slice(0, limit)
            .map(player => ({
                address: player.address,
                wins: player.wins,
                losses: player.losses,
                totalMatches: player.totalMatches,
                gtWon: player.gtWon.toFixed(2),
                gtLost: player.gtLost.toFixed(2),
                netGT: (player.gtWon - player.gtLost).toFixed(2),
                winRate: player.winRate.toFixed(1)
            }));

        res.json({
            leaderboard: sortedPlayers,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get purchase leaderboard (top purchasers)
app.get('/purchases', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;

        const sortedPurchasers = Object.values(purchaseStats)
            .sort((a, b) => b.totalUSDTSpent - a.totalUSDTSpent)
            .slice(0, limit)
            .map(purchaser => ({
                address: purchaser.address,
                totalPurchases: purchaser.totalPurchases,
                totalUSDTSpent: purchaser.totalUSDTSpent.toFixed(2),
                totalGTReceived: purchaser.totalGTReceived.toFixed(2),
                firstPurchase: purchaser.firstPurchase,
                lastPurchase: purchaser.lastPurchase
            }));

        res.json({
            purchaseLeaderboard: sortedPurchasers,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get player statistics
app.get('/player/:address', (req, res) => {
    try {
        const { address } = req.params;
        const playerStat = playerStats[address.toLowerCase()];
        const purchaseStat = purchaseStats[address.toLowerCase()];

        if (!playerStat && !purchaseStat) {
            return res.json({
                address,
                gaming: null,
                purchasing: null,
                message: 'No activity found for this address'
            });
        }

        res.json({
            address,
            gaming: playerStat ? {
                wins: playerStat.wins,
                losses: playerStat.losses,
                totalMatches: playerStat.totalMatches,
                gtWon: playerStat.gtWon.toFixed(2),
                gtLost: playerStat.gtLost.toFixed(2),
                netGT: (playerStat.gtWon - playerStat.gtLost).toFixed(2),
                winRate: playerStat.winRate.toFixed(1)
            } : null,
            purchasing: purchaseStat ? {
                totalPurchases: purchaseStat.totalPurchases,
                totalUSDTSpent: purchaseStat.totalUSDTSpent.toFixed(2),
                totalGTReceived: purchaseStat.totalGTReceived.toFixed(2),
                firstPurchase: purchaseStat.firstPurchase,
                lastPurchase: purchaseStat.lastPurchase
            } : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent events
app.get('/events', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const type = req.query.type;

        let filteredEvents = events;
        if (type) {
            filteredEvents = events.filter(event => event.type === type);
        }

        res.json({
            events: filteredEvents.slice(0, limit),
            total: filteredEvents.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get platform statistics
app.get('/stats', (req, res) => {
    try {
        const totalPlayers = Object.keys(playerStats).length;
        const totalMatches = Object.values(playerStats).reduce((sum, player) => sum + player.totalMatches, 0) / 2; // Divide by 2 because each match involves 2 players
        const totalGTWagered = Object.values(playerStats).reduce((sum, player) => sum + player.gtWon + player.gtLost, 0);
        const totalPurchases = Object.values(purchaseStats).reduce((sum, purchaser) => sum + purchaser.totalPurchases, 0);
        const totalUSDTSpent = Object.values(purchaseStats).reduce((sum, purchaser) => sum + purchaser.totalUSDTSpent, 0);
        const totalGTPurchased = Object.values(purchaseStats).reduce((sum, purchaser) => sum + purchaser.totalGTReceived, 0);

        res.json({
            platform: {
                totalPlayers,
                totalMatches,
                totalGTWagered: totalGTWagered.toFixed(2),
                totalEvents: events.length
            },
            purchases: {
                totalPurchases,
                totalUSDTSpent: totalUSDTSpent.toFixed(2),
                totalGTPurchased: totalGTPurchased.toFixed(2),
                uniquePurchasers: Object.keys(purchaseStats).length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
async function startServer() {
    try {
        await initialize();

        app.listen(PORT, () => {
            console.log(`📊 Leaderboard API running on http://localhost:${PORT}`);
            console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard`);
            console.log(`💰 Purchases: http://localhost:${PORT}/purchases`);
            console.log(`📈 Stats: http://localhost:${PORT}/stats`);
        });
    } catch (error) {
        console.error('❌ Failed to start leaderboard service:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down leaderboard service...');
    process.exit(0);
});

// Start the service
startServer();

module.exports = app;
