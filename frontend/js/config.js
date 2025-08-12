// TriX Frontend Configuration

// Network Configuration
const NETWORKS = {
    sepolia: {
        chainId: '0xaa36a7', // 11155111 in hex
        chainName: 'Sepolia Test Network',
        nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['https://sepolia.infura.io/v3/'],
        blockExplorerUrls: ['https://sepolia.etherscan.io/']
    },
    localhost: {
        chainId: '0x7a69', // 31337 in hex
        chainName: 'Hardhat Local',
        nativeCurrency: {
            name: 'Ethereum',
            symbol: 'ETH',
            decimals: 18
        },
        rpcUrls: ['http://127.0.0.1:8545/'],
        blockExplorerUrls: ['']
    }
};

// Contract Addresses - UPDATE THESE AFTER DEPLOYMENT
const CONTRACT_ADDRESSES = {
    // Sepolia Testnet (update after deployment)
    sepolia: {
        gameToken: '0x0000000000000000000000000000000000000000',
        tokenStore: '0x0000000000000000000000000000000000000000',
        playGame: '0x0000000000000000000000000000000000000000',
        usdt: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06' // Sepolia USDT
    },
    // Local development (update after local deployment)
    localhost: {
        gameToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        tokenStore: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        playGame: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        usdt: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
    }
};

// Current network (change this based on deployment)
const CURRENT_NETWORK = 'localhost'; // Change to 'sepolia' for testnet

// Get current addresses
const ADDRESSES = CONTRACT_ADDRESSES[CURRENT_NETWORK];

// App Configuration
const CONFIG = {
    // Decimal places for display
    GT_DECIMALS: 18,
    USDT_DECIMALS: 6,

    // UI Configuration
    POLLING_INTERVAL: 5000, // 5 seconds
    TRANSACTION_TIMEOUT: 300000, // 5 minutes

    // Contract configuration
    PLATFORM_FEE_PERCENTAGE: 5, // 5%

    // Validation
    MIN_STAKE_AMOUNT: 0.01,
    MAX_STAKE_AMOUNT: 10000,
    MIN_PURCHASE_AMOUNT: 0.01,
    MAX_PURCHASE_AMOUNT: 100000
};

// Event configuration for real-time updates
const EVENTS_TO_LISTEN = [
    'TokensPurchased',
    'MatchCreated',
    'PlayerJoined',
    'MatchCompleted',
    'MatchCancelled'
];
