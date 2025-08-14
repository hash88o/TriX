# 🎮 TriX Tic-Tac-Toe - Web-Based Blockchain Gaming

A complete web-based tic-tac-toe game that integrates with the **TriX Gaming Platform** for blockchain-based staking, automated matchmaking, and trustless payouts.

## 🎯 Complete System Flow

### 1. **Connect Wallet** → MetaMask Integration

- Player opens the web app
- Connects MetaMask wallet
- Shows address & GT/USDT balances

### 2. **Buy GT Tokens** → USDT → GT Exchange

- Player enters USDT amount
- Approves USDT spending
- Calls `TokenStore.buy()` smart contract
- Receives GT tokens automatically

### 3. **Join Queue & Match** → Automatic Matchmaking

- Player clicks "Find Match" with chosen stake
- System searches for opponent with same stake
- When found, creates match on blockchain
- Both players notified and game room created

### 4. **Stake Tokens** → Both Must Stake

- Each player approves GT spending for PlayGame contract
- Calls `PlayGame.stake()` smart contract
- When both confirmed → Game starts

### 5. **Play Game** → Real-time Multiplayer

- Both clients join Socket.IO room
- Real-time turn-based gameplay
- Server validates moves and determines winner

### 6. **Commit Result** → Automated Payout

- Game server calls `PlayGame.commitResult()` smart contract
- Winner receives 2x stake automatically
- Transaction hash and explorer link provided

## 🏗️ Architecture

```
📁 TriX Tic-Tac-Toe Web App/
├── 📄 web/tictactoe.html          # Main game interface
├── 📄 web/tictactoe.css           # Modern responsive styling
├── 📄 web/tictactoe.js            # Game logic & blockchain integration
├── 📄 matchmaking-server.js       # Real-time matchmaking server
├── 📄 package.json                # Dependencies
└── 📄 WEB_README.md               # This documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 14+ and npm
- **MetaMask** browser extension
- **TriX Platform** running (smart contracts deployed)

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Matchmaking Server

```bash
npm start
```

You should see:

```
🎮 TriX Matchmaking Server running on port 3001
📊 Health check: http://localhost:3001/health
📈 Stats: http://localhost:3001/stats
🏆 Leaderboard: http://localhost:3001/leaderboard
```

### 3. Serve the Web App

```bash
# Using Python (if available)
python -m http.server 8080

# Or using Node.js http-server
npx http-server web -p 8080 --cors

# Or using any web server
```

### 4. Access the Game

Open your browser and navigate to:

```
http://localhost:8080/tictactoe.html
```

## 🎮 How to Play

### 1. Connect Wallet

- Click "Connect MetaMask"
- Approve connection in MetaMask
- View your ETH, USDT, and GT balances

### 2. Buy Game Tokens

- Enter USDT amount (e.g., 100)
- Click "Buy GT Tokens"
- Approve USDT spending in MetaMask
- Receive GT tokens automatically

### 3. Find a Match

- Enter stake amount in GT (e.g., 50)
- Click "Find Match"
- Wait for opponent with same stake
- Match created automatically

### 4. Stake and Play

- Both players must stake GT tokens
- Game starts when both have staked
- Play tic-tac-toe with alternating turns
- Winner determined automatically

### 5. Collect Winnings

- Winner receives 2x stake automatically
- Transaction hash provided
- View on blockchain explorer

## 🔗 TriX Platform Integration

### Smart Contract Integration

The web app integrates with your existing TriX smart contracts:

#### GameToken.sol

```javascript
// Check balance
const balance = await gameToken.balanceOf(address);

// Approve spending
await gameToken.approve(playGameAddress, amount);

// Transfer tokens
await gameToken.transferFrom(from, to, amount);
```

#### TokenStore.sol

```javascript
// Buy GT with USDT
await tokenStore.buy(usdtAmount);
```

#### PlayGame.sol

```javascript
// Create match
await playGame.createMatch(matchId, player1, player2, stake);

// Stake tokens
await playGame.stake(matchId);

// Commit result
await playGame.commitResult(matchId, winner);
```

### API Integration

The web app communicates with your TriX API:

```javascript
// Get leaderboard
const leaderboard = await fetch("http://localhost:3001/leaderboard");

// Get player stats
const stats = await fetch(`http://localhost:3001/player/${address}`);

// Get match details
const match = await fetch(`http://localhost:3001/matches/${matchId}`);
```

## 📊 Matchmaking System

### Real-time Matchmaking

- **Socket.IO** for real-time communication
- **Automatic pairing** by stake amount
- **Queue management** for waiting players
- **Instant match creation** when opponent found

### Match Flow

1. **Player A** searches for match with 50 GT stake
2. **Player B** searches for match with 50 GT stake
3. **System** automatically pairs them
4. **Match created** on blockchain
5. **Game room** established via Socket.IO
6. **Both players** stake tokens
7. **Game starts** when both have staked

## 🎯 Key Features

### ✅ Complete Blockchain Integration

- **MetaMask** wallet connection
- **Smart contract** interactions
- **Token purchasing** (USDT → GT)
- **Automated staking** and payouts
- **Transaction history** with explorer links

### ✅ Real-time Multiplayer

- **Socket.IO** for instant communication
- **Live matchmaking** system
- **Real-time game updates**
- **Automatic win detection**

### ✅ Modern Web Interface

- **Responsive design** for all devices
- **Modern UI/UX** with TriX branding
- **Real-time balance updates**
- **Transaction status** indicators

### ✅ Security & Validation

- **Move validation** on server
- **Turn enforcement** (players can only move on their turn)
- **Smart contract** security (reentrancy protection, access control)
- **Input validation** and error handling

## 🔧 Configuration

### Environment Variables

```bash
# Matchmaking Server
PORT=3001
NODE_ENV=development

# TriX Platform Integration
TRIX_API_URL=http://localhost:3000
TRIX_CONTRACT_ADDRESSES={
  "gameToken": "0x...",
  "tokenStore": "0x...",
  "playGame": "0x...",
  "mockUSDT": "0x..."
}
```

### Contract Addresses

Update the contract addresses in `web/tictactoe.js`:

```javascript
this.contractAddresses = {
  gameToken: "0x1234567890123456789012345678901234567890",
  tokenStore: "0x0987654321098765432109876543210987654321",
  playGame: "0xabcdef1234567890abcdef1234567890abcdef12",
  mockUSDT: "0xfedcba0987654321fedcba0987654321fedcba09",
};
```

## 🚀 Deployment

### Local Development

```bash
# Terminal 1: Start TriX platform
npm run node
npm run deploy
npm start

# Terminal 2: Start matchmaking server
node matchmaking-server.js

# Terminal 3: Serve web app
npx http-server web -p 8080 --cors
```

### Production Deployment

#### Vercel Deployment

1. **Create Vercel account** and install CLI
2. **Initialize project**:
   ```bash
   vercel init
   ```
3. **Configure build settings**:
   ```json
   {
     "builds": [
       {
         "src": "web/**",
         "use": "@vercel/static"
       }
     ]
   }
   ```
4. **Deploy**:
   ```bash
   vercel --prod
   ```

#### Environment Setup

- Set contract addresses in environment variables
- Configure API endpoints for production
- Set up SSL certificates
- Configure CORS for production domains

## 🧪 Testing

### Manual Testing

1. **Open two browser windows**
2. **Connect different MetaMask accounts**
3. **Buy GT tokens** in both accounts
4. **Search for matches** with same stake
5. **Verify automatic pairing**
6. **Test complete game flow**

### Automated Testing

```bash
# Test matchmaking server
curl http://localhost:3001/health

# Test leaderboard API
curl http://localhost:3001/leaderboard

# Test stats endpoint
curl http://localhost:3001/stats
```

## 📈 Performance Metrics

### Expected Performance

- **Matchmaking**: < 2 seconds
- **Game moves**: < 100ms response time
- **Blockchain transactions**: < 30 seconds
- **Concurrent players**: 100+ simultaneous

### Scalability

- **Horizontal scaling** via multiple server instances
- **Load balancing** for matchmaking
- **Database integration** for persistent stats
- **CDN** for static assets

## 🔮 Future Enhancements

### Planned Features

- **Tournament mode** with brackets
- **Achievement system** with NFTs
- **Spectator mode** for watching games
- **Chat system** during matches
- **Mobile app** with React Native

### Advanced Integrations

- **Cross-chain support** (Polygon, BSC)
- **Layer 2 scaling** (Optimism, Arbitrum)
- **Decentralized storage** (IPFS)
- **AI opponents** with staking

## 🛡️ Security Considerations

### Smart Contract Security

- **Reentrancy protection** on all contracts
- **Access control** for admin functions
- **Input validation** and bounds checking
- **Emergency pause** functionality

### Web App Security

- **HTTPS** for all communications
- **CORS** configuration for production
- **Input sanitization** and validation
- **Rate limiting** on API endpoints

### Matchmaking Security

- **Anti-cheat** detection systems
- **Disconnect handling** and forfeits
- **Session management** and cleanup
- **DDoS protection** and rate limiting

## 🤝 Contributing

### Development Guidelines

1. **Follow JavaScript** best practices
2. **Add comprehensive** error handling
3. **Test thoroughly** before submitting
4. **Update documentation** for changes

### Code Structure

- **Modular design** for easy maintenance
- **Clear separation** of concerns
- **Comprehensive comments** for complex logic
- **Consistent naming** conventions

## 📄 License

This project is part of the TriX Gaming Platform and follows the same licensing terms.

## 🙏 Acknowledgments

Built with:

- **Ethers.js** for blockchain interaction
- **Socket.IO** for real-time communication
- **Express.js** for API server
- **MetaMask** for wallet integration
- **TriX Platform** for blockchain infrastructure

---

## 🎯 Ready to Play?

The web-based TriX Tic-Tac-Toe game provides a complete blockchain gaming experience with:

✅ **Full TriX Platform Integration**  
✅ **Real-time Matchmaking**  
✅ **Automated Staking & Payouts**  
✅ **Modern Web Interface**  
✅ **Production Ready**

Start the servers, open the game, and experience the future of blockchain gaming! 🚀
