# TriX Blockchain Gaming System

A blockchain-based PvP gaming incentive system that enables trustless match staking, secure token transfers, and seamless USDT-to-GameToken purchases.

## 🎮 Overview

TriX is a comprehensive gaming platform that combines blockchain technology with competitive gaming. Players can:

- Purchase GameTokens (GT) using USDT at a 1:1 conversion rate
- Create and join PvP matches with equal stakes
- Participate in trustless, automated payouts
- Enjoy secure, transparent gaming experiences

## 🏗️ Architecture

### Smart Contracts

1. **GameToken (GT)** - ERC-20 compliant gaming token
   - Only TokenStore can mint new tokens
   - Includes emergency pause functionality
   - Access control for minting permissions

2. **TokenStore** - USDT to GT conversion platform
   - 1:1 USDT to GT conversion rate
   - Handles USDT payments and GT minting
   - Treasury management and emergency controls

3. **PlayGame** - Match staking and escrow system
   - Accepts equal GT stakes from two players
   - Implements escrow functionality
   - Automated winner payouts with platform fees
   - Re-entrancy protection and access controls

### System Flow

```
1. Player purchases GT with USDT via TokenStore
2. Player creates match and stakes GT via PlayGame
3. Second player joins match with equal stake
4. Game server determines winner
5. API Gateway calls completeMatch() with winner
6. Winner receives payout (total stake - platform fee)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Hardhat development environment
- MetaMask or similar wallet

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd trix-blockchain-gaming

# Install dependencies
npm install

# Compile contracts
npm run compile

# Run tests
npm test

# Generate coverage report
npm run coverage
```

### Local Development

```bash
# Start local blockchain
npx hardhat node

# Deploy contracts to local network
npx hardhat run scripts/deploy.js --network localhost

# Run tests with gas reporting
npm run gas-report
```

### Testnet Deployment

```bash
# Set environment variables
export PRIVATE_KEY="your-private-key"
export TESTNET_RPC_URL="your-testnet-rpc-url"
export USDT_ADDRESS="testnet-usdt-address"
export TREASURY_ADDRESS="your-treasury-address"

# Deploy to testnet
npm run deploy:testnet
```

### Mainnet Deployment

```bash
# Set environment variables
export PRIVATE_KEY="your-private-key"
export MAINNET_RPC_URL="your-mainnet-rpc-url"
export USDT_ADDRESS="0xdAC17F958D2ee523a2206206994597C13D831ec7" # Mainnet USDT
export TREASURY_ADDRESS="your-treasury-address"
export ETHERSCAN_API_KEY="your-etherscan-api-key"

# Deploy to mainnet
npm run deploy:mainnet

# Verify contracts
npm run verify
```

## 📋 Contract Addresses

After deployment, contract addresses will be saved to `deployments/{network}.json`:

```json
{
  "network": "sepolia",
  "contracts": {
    "GameToken": "0x...",
    "TokenStore": "0x...",
    "PlayGame": "0x..."
  },
  "configuration": {
    "USDT_ADDRESS": "0x...",
    "TREASURY_ADDRESS": "0x...",
    "INITIAL_SUPPLY": "1000000000000000000000000"
  }
}
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Network Configuration
PRIVATE_KEY=your-private-key
TESTNET_RPC_URL=https://sepolia.infura.io/v3/YOUR-PROJECT-ID
MAINNET_RPC_URL=https://mainnet.infura.io/v3/YOUR-PROJECT-ID

# Contract Addresses
USDT_ADDRESS=0xdAC17F958D2ee523a2206206994597C13D831ec7
TREASURY_ADDRESS=your-treasury-address

# API Keys
ETHERSCAN_API_KEY=your-etherscan-api-key
COINMARKETCAP_API_KEY=your-coinmarketcap-api-key
```

### Network Configuration

Update `hardhat.config.js` with your network settings:

```javascript
networks: {
  testnet: {
    url: process.env.TESTNET_RPC_URL,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 11155111, // Sepolia
  },
  mainnet: {
    url: process.env.MAINNET_RPC_URL,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    chainId: 1,
  },
}
```

## 🧪 Testing

### Run All Tests

```bash
npm test
```

### Run Specific Test Files

```bash
# Test GameToken contract
npx hardhat test test/GameToken.test.js

# Test TokenStore contract
npx hardhat test test/TokenStore.test.js

# Test PlayGame contract
npx hardhat test test/PlayGame.test.js
```

### Coverage Report

```bash
npm run coverage
```

### Gas Optimization

```bash
npm run gas-report
```

## 🔒 Security Features

### Access Controls

- **MINTER_ROLE**: Only TokenStore can mint GT tokens
- **API_GATEWAY_ROLE**: Only authorized API Gateway can complete matches
- **PAUSER_ROLE**: Emergency pause functionality
- **DEFAULT_ADMIN_ROLE**: Contract administration

### Security Measures

- Re-entrancy protection on all fund transfers
- Input validation and sanitization
- Emergency pause mechanisms
- Access control on sensitive functions
- Comprehensive error handling

### Audit Checklist

- [ ] External security audit completed
- [ ] Access controls verified
- [ ] Re-entrancy protection tested
- [ ] Emergency functions tested
- [ ] Gas optimization verified
- [ ] Test coverage > 95%

## 📊 Gas Optimization

### Current Gas Costs (approximate)

| Function | Gas Cost |
|----------|----------|
| GameToken.mint() | ~50,000 |
| TokenStore.purchaseTokens() | ~120,000 |
| PlayGame.createMatch() | ~80,000 |
| PlayGame.joinMatch() | ~60,000 |
| PlayGame.completeMatch() | ~45,000 |

### Optimization Strategies

- Use `unchecked` blocks for safe arithmetic
- Optimize storage layout
- Batch operations where possible
- Use events instead of storage for non-critical data

## 🚨 Emergency Procedures

### Pause System

```javascript
// Pause all operations
await gameToken.pause();
await tokenStore.pause();
await playGame.pause();

// Unpause when safe
await gameToken.unpause();
await tokenStore.unpause();
await playGame.unpause();
```

### Emergency Withdrawals

```javascript
// Withdraw stuck tokens
await tokenStore.emergencyWithdraw(tokenAddress, recipient, amount);
await playGame.emergencyWithdrawGT(recipient, amount);
```

## 🔄 API Integration

### Required API Endpoints

1. **POST /purchase** - Handle GT purchases
2. **POST /match/start** - Initialize match staking
3. **POST /match/result** - Submit match results

### Authentication

Use JWT tokens for API Gateway authentication:

```javascript
// Example API Gateway integration
const apiGateway = new ethers.Wallet(PRIVATE_KEY, provider);
await playGame.connect(apiGateway).completeMatch(matchId, winner);
```

## 📈 Monitoring

### Key Metrics

- Total GT supply and circulation
- USDT to GT conversion volume
- Match creation and completion rates
- Platform fee collection
- Gas usage optimization

### Alerting

Set up monitoring for:
- Contract pause events
- Large token transfers
- Failed transactions
- Gas price spikes
- Unusual activity patterns

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Standards

- Follow Solidity style guide
- Write comprehensive tests
- Document all functions
- Use TypeScript for JavaScript code
- Maintain >95% test coverage

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review the test files for examples
- Contact the development team

## 🔮 Roadmap

### Phase 1: Smart Contracts ✅
- [x] GameToken contract
- [x] TokenStore contract
- [x] PlayGame contract
- [x] Comprehensive testing
- [x] Security implementation

### Phase 2: Integration & Testing
- [ ] Contract integration testing
- [ ] Security audit
- [ ] Testnet deployment
- [ ] Performance optimization

### Phase 3: API Gateway
- [ ] RESTful API development
- [ ] Blockchain integration layer
- [ ] Authentication system
- [ ] Rate limiting and validation

### Phase 4: Frontend Interface
- [ ] Wallet integration
- [ ] User interface development
- [ ] Admin dashboard
- [ ] Real-time updates

### Phase 5: Deployment & Operations
- [ ] Mainnet deployment
- [ ] Monitoring setup
- [ ] Documentation completion
- [ ] Community launch

---

**Disclaimer**: This software is provided "as is" without warranty. Use at your own risk. Always test thoroughly on testnets before mainnet deployment.
