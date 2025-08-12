# 🎮 TriX Gaming Platform

> A complete blockchain-based competitive gaming platform with smart contracts, real-time leaderboards, and trustless match staking.

## 📖 Project Overview

TriX is a decentralized gaming platform that enables players to:

- 💰 **Purchase GameTokens (GT)** using USDT through an automated exchange
- 🎯 **Create and join PvP matches** with equal stakes using GT tokens
- 🏆 **Compete in trustless matches** with automated escrow and payouts
- 📊 **Track performance** on real-time leaderboards with comprehensive statistics
- 🚰 **Access test funds** through built-in USDT faucet for development

## 🎯 Key Features

### 🔗 Blockchain Infrastructure

- **Smart Contracts**: Secure, audited Solidity contracts for token management and match escrow
- **ERC-20 Tokens**: GameToken (GT) with 18 decimals for gaming economy
- **Mock USDT**: 6-decimal test token with built-in faucet for development
- **Automated Deployment**: One-command deployment with environment setup

### 🎮 Gaming Mechanics

- **Match Creation**: Stake GT tokens and wait for opponents
- **Equal Stakes**: Fair play with matching stake requirements
- **Automated Escrow**: Secure token holding during matches
- **Winner Payouts**: 95% of total pot goes to winner (5% platform fee)
- **Match Cancellation**: Cancel pending matches and receive refunds

### 📊 Real-time Analytics

- **Gaming Leaderboard**: Rankings by GT won, win rates, and match history
- **Purchase Leaderboard**: Top players by USDT spending
- **Live Event Tracking**: Real-time blockchain event monitoring
- **Platform Statistics**: Total volume, matches, and player metrics

### 🌐 Full-Stack Platform

- **Backend API**: Express.js server with comprehensive endpoints
- **Frontend Interface**: Modern web UI with MetaMask integration
- **Service Orchestration**: One-command startup for all services
- **Development Tools**: Testing suite, deployment scripts, and monitoring

## 🏗️ Project Architecture

```
📁 TriX Gaming Platform/
├── 📁 contracts/              # Smart Contracts (Solidity)
│   ├── GameToken.sol          # ERC-20 gaming token (18 decimals)
│   ├── PlayGame.sol           # Match escrow & payout system
│   ├── TokenStore.sol         # USDT → GT exchange (1:1 ratio)
│   ├── 📁 interfaces/
│   │   └── IUSDT.sol          # USDT token interface
│   └── 📁 mocks/
│       └── MockUSDT.sol       # Test USDT with faucet (6 decimals)
├── 📁 api/                    # Backend API (Express.js)
│   ├── index.js               # Main server with all endpoints
│   └── package.json           # API dependencies
├── 📁 tools/                  # Real-time Analytics
│   └── leaderboard.js         # Event listener & leaderboard API
├── 📁 scripts/                # Deployment & Orchestration
│   ├── deploy.js              # Deploy contracts + generate .env
│   ├── start-all.js           # Launch all services
│   └── verify-deployment.js   # Deployment verification
├── 📁 test/                   # Comprehensive Test Suite
│   ├── GameToken.test.js      # Token contract tests
│   ├── PlayGame.test.js       # Match system tests
│   ├── TokenStore.test.js     # Exchange mechanism tests
│   └── 📁 integration/
│       └── E2E.test.js        # End-to-end testing
├── 📁 web/                    # Frontend Interface
│   └── index.html             # Complete gaming platform UI
├── hardhat.config.js          # Hardhat blockchain configuration
├── package.json               # Main project dependencies
└── README.md                  # This documentation
```

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js** 18+ and npm
- **MetaMask** browser extension
- **Git** for cloning the repository

### 1. Clone and Install

```bash
git clone <your-repository-url>
cd trix-gaming-platform
npm install
```

### 2. Start Local Blockchain

Open **Terminal 1**:

```bash
npm run node
```

This starts a local Hardhat blockchain with pre-funded test accounts.

### 3. Deploy Smart Contracts

Open **Terminal 2**:

```bash
npm run deploy
```

This will:

- ✅ Deploy all smart contracts (GameToken, TokenStore, PlayGame, MockUSDT)
- ✅ Set up proper roles and permissions
- ✅ Generate `.env` file with contract addresses
- ✅ Create ABI files for the API

### 4. Start All Services

Open **Terminal 3**:

```bash
npm start
```

This launches:

- 🌐 **Frontend**: http://localhost:8080
- 📡 **Backend API**: http://localhost:3000
- 📊 **Leaderboard API**: http://localhost:3001

### 5. Connect and Play

1. Open http://localhost:8080 in your browser
2. Connect MetaMask to localhost network (Chain ID: 31337)
3. Get test USDT from the faucet (1000 USDT button)
4. Purchase GT tokens using your USDT
5. Create or join matches and start gaming!

## 🎮 How to Play

### Getting Started

1. **Get Test Funds**: Click "Get Test USDT" to receive 1000 USDT
2. **Buy GameTokens**: Exchange USDT for GT at 1:1 ratio
3. **Check Balance**: View your ETH, USDT, and GT balances

### Playing Matches

1. **Create Match**: Enter GT stake amount and click "Create Match"
2. **Join Match**: Browse available matches and click "Join Match"
3. **Match Completion**: Winners receive 95% of total pot automatically

### Tracking Performance

1. **Gaming Leaderboard**: View top players by GT won and win rates
2. **Purchase Rankings**: See top USDT spenders
3. **Event Log**: Track all platform transactions in real-time
4. **Platform Stats**: View overall platform metrics

## 🔧 API Documentation

### Backend API Endpoints (Port 3000)

#### 🔗 System

```bash
GET  /health              # API health check
GET  /stats               # Platform statistics
```

#### 💰 Token Operations

```bash
POST /faucet/usdt         # Get test USDT (1000 USDT)
GET  /balance/:address    # Get GT balance for address
GET  /usdt-balance/:address # Get USDT balance for address
GET  /purchase?amount=10  # Calculate GT for USDT amount
```

#### 🎮 Match Management

```bash
GET  /matches/pending     # Get available matches
GET  /match/:matchId      # Get match details
GET  /player/:address/matches # Get player's match history
POST /match/result        # Submit match result (API Gateway)
POST /match/refund        # Cancel/refund match
```

### Leaderboard API Endpoints (Port 3001)

```bash
GET /health               # Service health check
GET /leaderboard?limit=10 # Gaming leaderboard (top players)
GET /purchases?limit=10   # Purchase leaderboard (top spenders)
GET /player/:address      # Individual player statistics
GET /events?limit=50      # Recent platform events
GET /stats                # Platform analytics
```

## 🧪 Testing

### Run Smart Contract Tests

```bash
npm test                  # Run all tests
npm run coverage          # Generate coverage report
```

### Test Individual Components

```bash
npx hardhat test test/GameToken.test.js    # Token tests
npx hardhat test test/PlayGame.test.js     # Match tests
npx hardhat test test/TokenStore.test.js   # Exchange tests
```

### Integration Testing

```bash
# Complete end-to-end testing
npm run node              # Terminal 1: Start blockchain
npm run deploy            # Terminal 2: Deploy contracts
npm start                 # Terminal 3: Start services
# Open http://localhost:8080 and test manually
```

## 📋 Smart Contract Details

### GameToken.sol

- **Type**: ERC-20 token with 18 decimals
- **Symbol**: GT (GameToken)
- **Features**: Minting (TokenStore only), burning, pausable
- **Security**: Access control, reentrancy protection

### TokenStore.sol

- **Function**: USDT → GT exchange at 1:1 ratio
- **Features**: Automated minting, treasury management
- **Security**: Reentrancy guards, access control

### PlayGame.sol

- **Function**: Match creation, joining, and escrow
- **Features**: Equal stakes, automated payouts, 5% platform fee
- **Security**: Access control, match state validation

### MockUSDT.sol

- **Function**: Test USDT token for development
- **Features**: Built-in faucet (1000 USDT/day), 6 decimals
- **Purpose**: Local testing and development

## 🔒 Security Features

### Smart Contract Security

- ✅ **Reentrancy Guards**: All state-changing functions protected
- ✅ **Access Control**: Role-based permissions (Admin, Minter, API Gateway)
- ✅ **Pausable**: Emergency stop functionality
- ✅ **Input Validation**: Comprehensive parameter checking
- ✅ **CEI Pattern**: Checks-Effects-Interactions implementation

### Platform Security

- ✅ **MetaMask Integration**: Secure transaction signing
- ✅ **Environment Protection**: Sensitive data in .env (gitignored)
- ✅ **CORS Configuration**: Proper cross-origin resource sharing
- ✅ **Error Handling**: Graceful failure management

## 🛠️ Development Commands

### Individual Services

```bash
npm run frontend          # Frontend only (port 8080)
npm run api              # Backend API only (port 3000)
npm run leaderboard      # Leaderboard only (port 3001)
```

### Development Tools

```bash
npm run compile          # Compile smart contracts
npm run lint             # Lint Solidity code
npm run gas-report       # Analyze gas usage
```

### Network Deployment

```bash
npm run deploy:testnet   # Deploy to testnet (requires .env)
npm run deploy:mainnet   # Deploy to mainnet (requires .env)
```

## 🌐 Environment Configuration

The deployment script automatically creates a `.env` file, but you can customize:

```env
# Blockchain Configuration
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=your_private_key_here

# Contract Addresses (auto-generated)
GAMETOKEN_ADDR=0x...
TOKENSTORE_ADDR=0x...
PLAYGAME_ADDR=0x...
MOCKUSDT_ADDR=0x...

# API Configuration
PORT=3000
LEADERBOARD_PORT=3001

# Treasury Configuration
TREASURY_ADDRESS=0x...
```

## 🐛 Troubleshooting

### Common Issues

**Services not starting:**

- Ensure ports 3000, 3001, 8080 are available
- Check that blockchain node is running first
- Verify .env file contains contract addresses

**MetaMask connection issues:**

- Switch to localhost network (Chain ID: 31337)
- Import test account using private key from blockchain output
- Reset MetaMask account if transactions seem stuck

**Transaction failures:**

- Check gas limits and network congestion
- Ensure sufficient ETH for gas fees
- Verify contract addresses in .env

**Frontend not loading:**

- Confirm all services are running
- Check browser console for errors
- Try refreshing the page

### Getting Help

1. **Check Logs**: Service logs appear in the terminal
2. **API Health**: Visit http://localhost:3000/health
3. **Leaderboard Health**: Visit http://localhost:3001/health
4. **Browser Console**: Check for JavaScript errors

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Standards

- Write comprehensive tests for new features
- Follow existing code style and patterns
- Update documentation for user-facing changes
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

Built with:

- **Hardhat** for smart contract development
- **OpenZeppelin** for secure contract templates
- **Express.js** for backend API
- **ethers.js** for blockchain interaction
- **MetaMask** for wallet integration

---

## 🎯 Ready to Play?

**For Players:**

```bash
npm install && npm run node && npm run deploy && npm start
```

Then open http://localhost:8080 and start gaming! 🎮

**For Developers:**
Explore the codebase, run tests, and contribute to the future of blockchain gaming! 🚀

---

_Built with ❤️ for the blockchain gaming community_
