const express = require('express');
const { ethers } = require('ethers');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

// Global variables
let provider;
let wallet;
let contracts = {};

// Contract ABIs (will be loaded from files)
let ABIS = {};

// Initialize blockchain connection
async function initializeBlockchain() {
    try {
        // Connect to network
        const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
        provider = new ethers.JsonRpcProvider(rpcUrl);

        // Initialize wallet
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('PRIVATE_KEY not found in environment variables');
        }
        wallet = new ethers.Wallet(privateKey, provider);

        console.log('🔗 Connected to blockchain');
        console.log('📍 Wallet address:', wallet.address);

        // Load ABIs
        await loadABIs();

        // Initialize contracts
        await initializeContracts();

        console.log('✅ Blockchain initialization complete');
        return true;
    } catch (error) {
        console.error('❌ Blockchain initialization failed:', error.message);
        return false;
    }
}

// Load contract ABIs
async function loadABIs() {
    try {
        const abiPath = path.join(__dirname, 'abis');

        // Create ABIs directory if it doesn't exist
        if (!fs.existsSync(abiPath)) {
            fs.mkdirSync(abiPath, { recursive: true });
        }

        // Basic ERC20 ABI for tokens
        ABIS.ERC20 = [
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address,uint256) returns (bool)",
            "function transferFrom(address,address,uint256) returns (bool)",
            "function approve(address,uint256) returns (bool)",
            "function allowance(address,address) view returns (uint256)",
            "function mint(address,uint256) external",
            "event Transfer(address indexed,address indexed,uint256)"
        ];

        // TokenStore ABI
        ABIS.TokenStore = [
            "function buy(uint256) external",
            "function getGTAmount(uint256) view returns (uint256)",
            "function getUSDTAmount(uint256) view returns (uint256)",
            "function withdrawUSDT(address,uint256) external",
            "function totalPurchases() view returns (uint256)",
            "function totalUSDTReceived() view returns (uint256)",
            "function getStats() view returns (uint256,uint256,uint256)",
            "event Purchase(address indexed,uint256,uint256)"
        ];

        // PlayGame ABI
        ABIS.PlayGame = [
            "function createMatch(bytes32,address,address,uint256) external",
            "function stake(bytes32) external",
            "function commitResult(bytes32,address) external",
            "function refund(bytes32) external",
            "function getMatch(bytes32) view returns (tuple(bytes32,address,address,uint256,uint8,uint256,bool,bool))",
            "function canRefund(bytes32) view returns (bool)",
            "function getStats() view returns (uint256,uint256,uint256)",
            "event MatchCreated(bytes32 indexed,address indexed,address indexed,uint256)",
            "event Staked(bytes32 indexed,address indexed,uint256)",
            "event Settled(bytes32 indexed,address indexed,uint256)",
            "event Refunded(bytes32 indexed,address indexed,uint256)"
        ];

        console.log('📝 ABIs loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load ABIs:', error.message);
        throw error;
    }
}

// Initialize contract instances
async function initializeContracts() {
    try {
        contracts.gameToken = new ethers.Contract(
            process.env.GAMETOKEN_ADDR,
            ABIS.ERC20,
            wallet
        );

        contracts.tokenStore = new ethers.Contract(
            process.env.TOKENSTORE_ADDR,
            ABIS.TokenStore,
            wallet
        );

        contracts.playGame = new ethers.Contract(
            process.env.PLAYGAME_ADDR,
            ABIS.PlayGame,
            wallet
        );

        contracts.mockUsdt = new ethers.Contract(
            process.env.MOCKUSDT_ADDR,
            ABIS.ERC20,
            wallet
        );

        console.log('🎮 Contracts initialized');
    } catch (error) {
        console.error('❌ Contract initialization failed:', error.message);
        throw error;
    }
}

// ========== API ROUTES ==========

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        contracts: {
            GAME_TOKEN: process.env.GAMETOKEN_ADDR,
            TOKEN_STORE: process.env.TOKENSTORE_ADDR,
            PLAY_GAME: process.env.PLAYGAME_ADDR,
            MOCK_USDT: process.env.MOCKUSDT_ADDR
        }
    });
});

// Get player balance
app.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const balance = await contracts.gameToken.balanceOf(address);
        res.json({
            address,
            balance: ethers.formatEther(balance),
            balanceWei: balance.toString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get USDT balance
app.get('/usdt-balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const balance = await contracts.mockUsdt.balanceOf(address);
        res.json({
            address,
            balance: ethers.formatUnits(balance, 6),
            balanceWei: balance.toString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Purchase tokens - calls TokenStore.buy()
app.get('/purchase', async (req, res) => {
    try {
        const { amount } = req.query;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount parameter' });
        }

        const usdtAmount = ethers.parseUnits(amount.toString(), 6);

        // Call TokenStore.buy() function
        const tx = await contracts.tokenStore.buy(usdtAmount);
        await tx.wait();

        const gtAmount = await contracts.tokenStore.getGTAmount(usdtAmount);

        res.json({
            success: true,
            txHash: tx.hash,
            usdtAmount: amount,
            gtAmount: ethers.formatEther(gtAmount),
            rate: '1:1'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// USDT Faucet
app.post('/faucet/usdt', async (req, res) => {
    try {
        const { address, amount = '1000' } = req.body;

        if (!address) {
            return res.status(400).json({ error: 'Address required' });
        }

        const mintAmount = ethers.parseUnits(amount, 6);
        const tx = await contracts.mockUsdt.mint(address, mintAmount);
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            amount: amount,
            address: address
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create match and coordinate stake flow
app.post('/match/start', async (req, res) => {
    try {
        console.log('Received match creation request:', req.body);
        const { p1, p2, stake, matchId } = req.body;

        console.log('Extracted parameters:', { p1, p2, stake, matchId });

        if (!p1 || !p2 || !stake) {
            console.log('Missing parameters detected:', {
                p1Missing: !p1,
                p2Missing: !p2,
                stakeMissing: !stake
            });
            return res.status(400).json({ error: 'Missing required parameters: p1, p2, stake' });
        }

        // Generate unique matchId using p1, p2, and timestamp (as specified)
        const timestamp = Math.floor(Date.now() / 1000);
        const uniqueMatchId = matchId || `match_${p1.slice(-6)}_${p2.slice(-6)}_${timestamp}`;

        // Generate bytes32 matchId using keccak256(abi.encodePacked(p1, p2, timestamp))
        const matchIdBytes32 = ethers.keccak256(
            ethers.solidityPacked(['address', 'address', 'uint256'], [p1, p2, timestamp])
        );

        const stakeAmount = ethers.parseEther(stake.toString());

        // Call createMatch on the contract
        const tx = await contracts.playGame.createMatch(matchIdBytes32, p1, p2, stakeAmount);
        await tx.wait();

        console.log(`✅ Match created: ${uniqueMatchId} (${matchIdBytes32})`);
        console.log(`   Players: ${p1} vs ${p2}`);
        console.log(`   Stake: ${stake} GT each`);

        res.json({
            success: true,
            txHash: tx.hash,
            matchId: matchIdBytes32,
            matchIdString: uniqueMatchId,
            players: [p1, p2],
            stake: stake,
            timestamp
        });
    } catch (error) {
        console.error('Match creation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stake in match
app.post('/match/stake', async (req, res) => {
    try {
        const { matchId, player } = req.body;

        // This endpoint can be used to track staking events
        res.json({
            success: true,
            matchId,
            player
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit match result - calls commitResult (Backend/Operator only)
app.post('/match/result', async (req, res) => {
    try {
        const { matchId, winner } = req.body;

        if (!matchId || !winner) {
            return res.status(400).json({ error: 'matchId and winner required' });
        }

        // Convert matchId to bytes32 if it's a string
        let matchIdBytes32;
        if (typeof matchId === 'string') {
            if (matchId.startsWith('0x') && matchId.length === 66) {
                // It's already a valid bytes32 hex string
                matchIdBytes32 = matchId;
            } else {
                // Convert string to bytes32 using solidityPacked
                matchIdBytes32 = ethers.keccak256(
                    ethers.solidityPacked(['string'], [matchId])
                );
            }
        } else {
            matchIdBytes32 = matchId;
        }

        console.log(`🎮 Submitting match result:`);
        console.log(`   Match ID: ${matchId} (${matchIdBytes32})`);
        console.log(`   Winner: ${winner}`);

        // Call commitResult on the smart contract
        const tx = await contracts.playGame.commitResult(matchIdBytes32, winner);
        await tx.wait();

        console.log(`✅ Match result submitted! Winner gets 2x stake.`);

        res.json({
            success: true,
            txHash: tx.hash,
            matchId: matchIdBytes32,
            winner,
            message: `Winner ${winner} receives 2x stake amount`
        });
    } catch (error) {
        console.error('Error submitting match result:', error);
        res.status(500).json({ error: error.message });
    }
});

// Refund pre-staked amount (for matchmaking timeouts)
app.post('/match/refund-prestake', async (req, res) => {
    try {
        const { player, amount } = req.body;

        if (!player || !amount) {
            return res.status(400).json({ error: 'player and amount required' });
        }

        console.log(`💸 Refunding pre-stake:`);
        console.log(`   Player: ${player}`);
        console.log(`   Amount: ${amount} GT`);

        const amountWei = ethers.parseEther(amount.toString());

        // Call refundPreStake on the smart contract
        const tx = await contracts.playGame.refundPreStake(player, amountWei);
        await tx.wait();

        console.log(`✅ Pre-stake refunded successfully!`);

        res.json({
            success: true,
            txHash: tx.hash,
            player,
            amount: amount,
            message: `Pre-stake refunded to ${player}`
        });
    } catch (error) {
        console.error('Error refunding pre-stake:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get matches for a specific player (pending stakes)
app.get('/matches/for-player/:address', async (req, res) => {
    try {
        const { address } = req.params;

        if (!address) {
            return res.status(400).json({ error: 'Player address required' });
        }

        // This would typically query a database or event logs
        // For now, return a sample response structure
        const pendingMatches = [];

        // In a real implementation, you'd query event logs:
        // - Filter MatchCreated events where p1 or p2 == address
        // - Check match status to see if player has staked
        // - Return matches where status is WAITING_FOR_STAKES

        res.json({
            success: true,
            player: address,
            pendingMatches,
            message: "Use event listeners to populate real match data"
        });
    } catch (error) {
        console.error('Error fetching player matches:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get match details
app.get('/match/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const match = await contracts.playGame.getMatch(matchId);

        res.json({
            matchId: match[0].toString(),
            player1: match[1],
            player2: match[2],
            stakeAmount: ethers.formatEther(match[3]),
            totalStake: ethers.formatEther(match[4]),
            status: match[5],
            createdAt: new Date(Number(match[6]) * 1000).toISOString(),
            completedAt: match[7] > 0 ? new Date(Number(match[7]) * 1000).toISOString() : null,
            winner: match[8]
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Refund expired match
app.post('/match/refund', async (req, res) => {
    try {
        const { matchId } = req.body;

        if (!matchId) {
            return res.status(400).json({ error: 'matchId required' });
        }

        const tx = await contracts.playGame.cancelMatch(matchId);
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            matchId
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get pending matches
app.get('/matches/pending', async (req, res) => {
    try {
        const limit = req.query.limit || 10;
        const matchIds = await contracts.playGame.getPendingMatches(limit);

        const matches = [];
        for (let id of matchIds) {
            const match = await contracts.playGame.getMatch(id);
            matches.push({
                matchId: match[0].toString(),
                player1: match[1],
                player2: match[2],
                stakeAmount: ethers.formatEther(match[3]),
                totalStake: ethers.formatEther(match[4]),
                status: match[5],
                createdAt: new Date(Number(match[6]) * 1000).toISOString()
            });
        }

        res.json({ matches });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get player matches
app.get('/player/:address/matches', async (req, res) => {
    try {
        const { address } = req.params;
        const matchIds = await contracts.playGame.getPlayerMatches(address);

        const matches = [];
        for (let id of matchIds) {
            const match = await contracts.playGame.getMatch(id);
            matches.push({
                matchId: match[0].toString(),
                player1: match[1],
                player2: match[2],
                stakeAmount: ethers.formatEther(match[3]),
                totalStake: ethers.formatEther(match[4]),
                status: match[5],
                createdAt: new Date(Number(match[6]) * 1000).toISOString(),
                completedAt: match[7] > 0 ? new Date(Number(match[7]) * 1000).toISOString() : null,
                winner: match[8]
            });
        }

        res.json({ matches });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get platform stats
app.get('/stats', async (req, res) => {
    try {
        const [totalMatches, totalStaked, totalPayouts, platformFee] = await contracts.playGame.getStats();
        const [totalPurchases, totalUSDTReceived, treasury] = await contracts.tokenStore.getStats();

        res.json({
            matches: {
                total: totalMatches.toString(),
                totalStaked: ethers.formatEther(totalStaked),
                totalPayouts: ethers.formatEther(totalPayouts),
                platformFeePercentage: platformFee.toString()
            },
            purchases: {
                total: totalPurchases.toString(),
                totalUSDTReceived: ethers.formatUnits(totalUSDTReceived, 6),
                treasury
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../web/index.html'));
});

// Start server
async function startServer() {
    try {
        console.log('🚀 Starting TriX API Server...');

        // Initialize blockchain connection
        const blockchainReady = await initializeBlockchain();
        if (!blockchainReady) {
            console.log('⚠️  Starting server without blockchain connection');
        }

        app.listen(PORT, () => {
            console.log(`🌐 API Server running on http://localhost:${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🎮 Frontend: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down API server...');
    process.exit(0);
});

// Start the server
startServer();

module.exports = app;
