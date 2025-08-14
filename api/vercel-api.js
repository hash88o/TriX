const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables for production
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/1NFhV9cMA4vShirJHIwX2";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS;

// Contract addresses (will be updated after deployment)
const CONTRACT_ADDRESSES = {
    GAME_TOKEN: process.env.GAMETOKEN_ADDR || "0x...", // Update after deployment
    TOKEN_STORE: process.env.TOKENSTORE_ADDR || "0x...", // Update after deployment
    PLAY_GAME: process.env.PLAYGAME_ADDR || "0x...", // Update after deployment
    MOCK_USDT: process.env.MOCKUSDT_ADDR || "0x..." // Update after deployment
};

// Initialize provider and signer
let provider, signer, contracts;

async function initializeBlockchain() {
    try {
        provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
        signer = new ethers.Wallet(PRIVATE_KEY, provider);

        // Load contract ABIs (you'll need to include these)
        const gameTokenABI = []; // Add your ABI here
        const tokenStoreABI = []; // Add your ABI here
        const playGameABI = []; // Add your ABI here

        contracts = {
            gameToken: new ethers.Contract(CONTRACT_ADDRESSES.GAME_TOKEN, gameTokenABI, signer),
            tokenStore: new ethers.Contract(CONTRACT_ADDRESSES.TOKEN_STORE, tokenStoreABI, signer),
            playGame: new ethers.Contract(CONTRACT_ADDRESSES.PLAY_GAME, playGameABI, signer)
        };

        console.log("✅ Blockchain initialized successfully");
    } catch (error) {
        console.error("❌ Blockchain initialization failed:", error);
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        contracts: CONTRACT_ADDRESSES,
        network: 'sepolia'
    });
});

// Get balances
app.get('/balances/:address', async (req, res) => {
    try {
        const { address } = req.params;

        const ethBalance = await provider.getBalance(address);
        const gtBalance = await contracts.gameToken.balanceOf(address);
        const usdtBalance = await contracts.tokenStore.balanceOf(address);

        res.json({
            eth: ethers.formatEther(ethBalance),
            gt: ethers.formatEther(gtBalance),
            usdt: ethers.formatEther(usdtBalance)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Buy GT with USDT
app.post('/buy-gt', async (req, res) => {
    try {
        const { amount } = req.body;
        const amountWei = ethers.parseEther(amount.toString());

        const tx = await contracts.tokenStore.buyGT(amountWei);
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            message: `Successfully bought ${amount} GT with USDT`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get USDT faucet
app.post('/faucet', async (req, res) => {
    try {
        const { address } = req.body;
        const amount = ethers.parseEther("100"); // 100 USDT

        const tx = await contracts.tokenStore.mintUSDT(address, amount);
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            message: `Sent 100 USDT to ${address}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create match
app.post('/match/start', async (req, res) => {
    try {
        const { p1, p2, stake, matchId } = req.body;

        const matchIdBytes32 = ethers.keccak256(
            ethers.solidityPacked(['string'], [matchId])
        );

        const tx = await contracts.playGame.createMatch(p1, p2, ethers.parseEther(stake.toString()));
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            matchId: matchIdBytes32,
            message: `Match created successfully`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Submit match result
app.post('/match/result', async (req, res) => {
    try {
        const { matchId, winner } = req.body;

        let matchIdBytes32;
        if (matchId.startsWith('0x') && matchId.length === 66) {
            matchIdBytes32 = matchId;
        } else {
            matchIdBytes32 = ethers.keccak256(
                ethers.solidityPacked(['string'], [matchId])
            );
        }

        const tx = await contracts.playGame.commitResult(matchIdBytes32, winner);
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            matchId: matchIdBytes32,
            winner,
            message: `Winner ${winner} receives 2x stake amount`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Refund pre-stake
app.post('/match/refund-prestake', async (req, res) => {
    try {
        const { player, amount } = req.body;
        const amountWei = ethers.parseEther(amount.toString());

        const tx = await contracts.playGame.refundPreStake(player, amountWei);
        await tx.wait();

        res.json({
            success: true,
            txHash: tx.hash,
            player,
            amount: amount,
            message: `Pre-stake refunded to ${player}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Initialize blockchain on startup
initializeBlockchain();

// Export for Vercel
module.exports = app;
