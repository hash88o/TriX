# 🎮 TriX - Web3 Gaming Platform

> **Real-time Tic-Tac-Toe with blockchain staking and rewards**

<div style="padding:49.06% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1110234987?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="TriX Gaming and Staking"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask wallet
- Sepolia testnet ETH

### Clone & Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/trix.git
cd trix

# Install dependencies
npm install

# Create environment file
```

### Environment Variables

Create `.env` file with:

```env
# Sepolia Network
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
ALCHEMY_API_KEY=your_alchemy_api_key
PRIVATE_KEY=your_wallet_private_key
TREASURY_ADDRESS=your_treasury_address

# Contract Addresses (will be auto-populated after deployment)
GAMETOKEN_ADDR=
TOKENSTORE_ADDR=
PLAYGAME_ADDR=
MOCKUSDT_ADDR=
```

### Deploy Contracts

```bash
# Deploy to Sepolia (requires .env setup)
npm run deploy:testnet

# Or deploy locally
npm run deploy
```

### Start Services

```bash
# Start all services (Hardhat node + Backend + Frontend)
npm start

# Or start individually:
npm run node          # Hardhat node
npm run api           # Backend API
npm run frontend      # Frontend server
```

## 🎯 Features

- **Real-time Matchmaking** - Find opponents instantly
- **Blockchain Staking** - Stake GT tokens to play
- **Smart Contract Integration** - On-chain game results
- **Etherscan Integration** - View all transactions
- **Web3 Wallet Support** - MetaMask integration

## 🏗️ Architecture

```
├── contracts/          # Smart contracts (Solidity)
├── web/               # Frontend (HTML/CSS/JS)
├── render-backend/    # Backend API + WebSocket
├── api/               # Vercel API functions
├── scripts/           # Deployment & utility scripts
└── test/              # Contract tests
```

## 🔧 Development

### Local Development

```bash
# Start Hardhat node
npm run node

# Deploy contracts locally
npm run deploy

# Start backend
cd render-backend && npm start

# Start frontend
cd web && python -m http.server 8080
```

### Testing

```bash
# Run all tests
npm test

# Run specific test
npm test test/PlayGame.test.js
```

### Deployment

```bash
# Deploy to Sepolia
npm run deploy:sepolia

# Deploy frontend to Vercel
vercel --prod

# Deploy backend to Render
# (Follow render-backend/README.md)
```

## 📱 Frontend

- **URL**: `http://localhost:8080` (local) / `https://frontend-trix.vercel.app` (prod)
- **Features**: Wallet connection, matchmaking, game board, transaction history

## 🔌 Backend

- **Local**: `http://localhost:3000`
- **Production**: `https://trix-mpe3.onrender.com`
- **Features**: REST API, WebSocket matchmaking, blockchain integration

## 📊 Smart Contracts

- **GameToken**: ERC20 token for staking
- **PlayGame**: Match management and result submission
- **TokenStore**: GT token purchase with USDT
- **MockUSDT**: Test USDT token

## 🌐 Networks

- **Local**: Hardhat (Chain ID: 1337)
- **Testnet**: Sepolia (Chain ID: 11155111)

## 🚨 Troubleshooting

### Common Issues

- **Port conflicts**: Kill existing Node processes with `taskkill /f /im node.exe`
- **Contract errors**: Ensure Hardhat node is running before deployment
- **WebSocket issues**: Check backend URL in frontend config

### Debug Tools

- Use debug buttons in frontend for match troubleshooting
- Check backend logs for detailed error information
- Use `/debug/match/:id` endpoint for on-chain verification

## 📝 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

**Need help?** Check the issues tab or create a new one with detailed error information.
