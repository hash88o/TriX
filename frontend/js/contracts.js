// Contract ABIs (simplified for frontend use)
const GAME_TOKEN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

const TOKEN_STORE_ABI = [
    "function gameToken() view returns (address)",
    "function usdtToken() view returns (address)",
    "function treasuryAddress() view returns (address)",
    "function DECIMAL_ADJUSTMENT() view returns (uint256)",
    "function purchaseTokens(uint256 usdtAmount) payable",
    "function getGTAmount(uint256 usdtAmount) view returns (uint256)",
    "function getUSDTAmount(uint256 gtAmount) view returns (uint256)",
    "function getStats() view returns (uint256 totalPurchases, uint256 totalUSDTReceived, address treasury)",
    "event TokensPurchased(address indexed buyer, uint256 usdtAmount, uint256 gtAmount, uint256 timestamp)"
];

const PLAY_GAME_ABI = [
    "function gameToken() view returns (address)",
    "function platformFeePercentage() view returns (uint256)",
    "function BASIS_POINTS() view returns (uint256)",
    "function createMatch(uint256 stakeAmount) returns (uint256)",
    "function joinMatch(uint256 matchId) payable",
    "function cancelMatch(uint256 matchId)",
    "function getMatch(uint256 matchId) view returns (tuple(uint256 matchId, address player1, address player2, uint256 stakeAmount, uint256 totalStake, uint8 status, uint256 createdAt, uint256 completedAt, address winner))",
    "function getPlayerMatches(address player) view returns (uint256[])",
    "function getPendingMatches(uint256 limit) view returns (uint256[])",
    "function getCurrentMatchId() view returns (uint256)",
    "function getStats() view returns (uint256 totalMatches, uint256 totalStaked, uint256 totalPayouts)",
    "event MatchCreated(uint256 indexed matchId, address indexed player1, uint256 stakeAmount)",
    "event PlayerJoined(uint256 indexed matchId, address indexed player2)",
    "event MatchCompleted(uint256 indexed matchId, address indexed winner, uint256 payout)",
    "event MatchCancelled(uint256 indexed matchId, address indexed player1, address indexed player2)"
];

const USDT_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// Contract instances (will be initialized when wallet connects)
let gameTokenContract = null;
let tokenStoreContract = null;
let playGameContract = null;
let usdtContract = null;
let provider = null;
let signer = null;

// Initialize contracts
async function initializeContracts(signerInstance) {
    try {
        signer = signerInstance;
        provider = signer.provider;

        // Initialize contract instances
        gameTokenContract = new ethers.Contract(ADDRESSES.gameToken, GAME_TOKEN_ABI, signer);
        tokenStoreContract = new ethers.Contract(ADDRESSES.tokenStore, TOKEN_STORE_ABI, signer);
        playGameContract = new ethers.Contract(ADDRESSES.playGame, PLAY_GAME_ABI, signer);
        usdtContract = new ethers.Contract(ADDRESSES.usdt, USDT_ABI, signer);

        console.log('Contracts initialized successfully');
        return true;
    } catch (error) {
        console.error('Error initializing contracts:', error);
        return false;
    }
}

// Token Store Functions
async function purchaseGameTokens(usdtAmount) {
    try {
        const usdtAmountWei = ethers.utils.parseUnits(usdtAmount.toString(), CONFIG.USDT_DECIMALS);
        const tx = await tokenStoreContract.purchaseTokens(usdtAmountWei);
        return await tx.wait();
    } catch (error) {
        console.error('Error purchasing tokens:', error);
        throw error;
    }
}

async function approveUSDT(amount) {
    try {
        const amountWei = ethers.utils.parseUnits(amount.toString(), CONFIG.USDT_DECIMALS);
        const tx = await usdtContract.approve(ADDRESSES.tokenStore, amountWei);
        return await tx.wait();
    } catch (error) {
        console.error('Error approving USDT:', error);
        throw error;
    }
}

async function getUSDTAllowance(userAddress) {
    try {
        const allowance = await usdtContract.allowance(userAddress, ADDRESSES.tokenStore);
        return ethers.utils.formatUnits(allowance, CONFIG.USDT_DECIMALS);
    } catch (error) {
        console.error('Error getting USDT allowance:', error);
        return '0';
    }
}

// PlayGame Functions
async function createMatch(stakeAmount) {
    try {
        const stakeAmountWei = ethers.utils.parseEther(stakeAmount.toString());
        const tx = await playGameContract.createMatch(stakeAmountWei);
        return await tx.wait();
    } catch (error) {
        console.error('Error creating match:', error);
        throw error;
    }
}

async function joinMatch(matchId) {
    try {
        const tx = await playGameContract.joinMatch(matchId);
        return await tx.wait();
    } catch (error) {
        console.error('Error joining match:', error);
        throw error;
    }
}

async function approveGameTokens(amount) {
    try {
        const amountWei = ethers.utils.parseEther(amount.toString());
        const tx = await gameTokenContract.approve(ADDRESSES.playGame, amountWei);
        return await tx.wait();
    } catch (error) {
        console.error('Error approving Game Tokens:', error);
        throw error;
    }
}

async function getGTAllowance(userAddress) {
    try {
        const allowance = await gameTokenContract.allowance(userAddress, ADDRESSES.playGame);
        return ethers.utils.formatEther(allowance);
    } catch (error) {
        console.error('Error getting GT allowance:', error);
        return '0';
    }
}

// Balance Functions
async function getETHBalance(address) {
    try {
        const balance = await provider.getBalance(address);
        return ethers.utils.formatEther(balance);
    } catch (error) {
        console.error('Error getting ETH balance:', error);
        return '0';
    }
}

async function getGTBalance(address) {
    try {
        const balance = await gameTokenContract.balanceOf(address);
        return ethers.utils.formatEther(balance);
    } catch (error) {
        console.error('Error getting GT balance:', error);
        return '0';
    }
}

async function getUSDTBalance(address) {
    try {
        const balance = await usdtContract.balanceOf(address);
        return ethers.utils.formatUnits(balance, CONFIG.USDT_DECIMALS);
    } catch (error) {
        console.error('Error getting USDT balance:', error);
        return '0';
    }
}

// Match Functions
async function getPendingMatches() {
    try {
        const matchIds = await playGameContract.getPendingMatches(10);
        const matches = [];

        for (let matchId of matchIds) {
            const match = await playGameContract.getMatch(matchId);
            matches.push({
                id: matchId.toString(),
                player1: match.player1,
                player2: match.player2,
                stakeAmount: ethers.utils.formatEther(match.stakeAmount),
                totalStake: ethers.utils.formatEther(match.totalStake),
                status: match.status,
                createdAt: new Date(match.createdAt.toNumber() * 1000)
            });
        }

        return matches;
    } catch (error) {
        console.error('Error getting pending matches:', error);
        return [];
    }
}

async function getPlayerMatches(playerAddress) {
    try {
        const matchIds = await playGameContract.getPlayerMatches(playerAddress);
        const matches = [];

        for (let matchId of matchIds) {
            const match = await playGameContract.getMatch(matchId);
            matches.push({
                id: matchId.toString(),
                player1: match.player1,
                player2: match.player2,
                stakeAmount: ethers.utils.formatEther(match.stakeAmount),
                totalStake: ethers.utils.formatEther(match.totalStake),
                status: match.status,
                winner: match.winner,
                createdAt: new Date(match.createdAt.toNumber() * 1000),
                completedAt: match.completedAt.toNumber() > 0 ? new Date(match.completedAt.toNumber() * 1000) : null
            });
        }

        return matches;
    } catch (error) {
        console.error('Error getting player matches:', error);
        return [];
    }
}
