# TriX Blockchain Gaming System - Deployment Guide

## Prerequisites

1. **Node.js and npm** installed
2. **MetaMask** browser extension
3. **Sepolia testnet ETH** for gas fees
4. **API keys** (Alchemy, Etherscan)

## Step-by-Step Deployment Process

### 1. Environment Setup

Create a `.env` file in the project root:

```bash
# Copy the example and fill in your details
cp ENV_SETUP.md .env
```

Fill in the required environment variables:

- `PRIVATE_KEY`: Your wallet private key (without 0x prefix)
- `ALCHEMY_API_KEY`: Get from https://alchemy.com
- `ETHERSCAN_API_KEY`: Get from https://etherscan.io
- `TREASURY_ADDRESS`: Your treasury wallet address
- `USDT_ADDRESS`: Sepolia testnet USDT address

### 2. Install Dependencies

```bash
npm install
```

### 3. Compile Contracts

```bash
npm run compile
```

### 4. Run Tests (Optional but Recommended)

```bash
npm test
```

### 5. Deploy to Sepolia Testnet

```bash
npm run deploy:testnet
```

This will:

- Deploy GameToken, TokenStore, and PlayGame contracts
- Set up proper roles and permissions
- Save deployment addresses to `deployment-info.json`

### 6. Verify Contracts on Etherscan

```bash
# Verify GameToken
npx hardhat verify --network sepolia <GAMETOKEN_ADDRESS> <INITIAL_SUPPLY> "TriX Game Token" "GT"

# Verify TokenStore
npx hardhat verify --network sepolia <TOKENSTORE_ADDRESS> <GAMETOKEN_ADDRESS> <USDT_ADDRESS> <TREASURY_ADDRESS>

# Verify PlayGame
npx hardhat verify --network sepolia <PLAYGAME_ADDRESS> <GAMETOKEN_ADDRESS>
```

### 7. Update Frontend Configuration

Update `frontend/js/config.js`:

```javascript
// Update contract addresses after deployment
const CONTRACT_ADDRESSES = {
  sepolia: {
    gameToken: "YOUR_DEPLOYED_GAMETOKEN_ADDRESS",
    tokenStore: "YOUR_DEPLOYED_TOKENSTORE_ADDRESS",
    playGame: "YOUR_DEPLOYED_PLAYGAME_ADDRESS",
    usdt: "0x7169D38820dfd117C3FA1f22a697dBA58d90BA06",
  },
};

// Set current network to sepolia
const CURRENT_NETWORK = "sepolia";
```

### 8. Test Frontend Locally

Open `frontend/index.html` in a web browser or serve it with a local server:

```bash
# Using Python
cd frontend
python -m http.server 8000

# Using Node.js (if you have serve installed)
npx serve frontend

# Or just open frontend/index.html in your browser
```

### 9. Verify Deployment

Run the verification script:

```bash
npx hardhat run scripts/verify-deployment.js --network sepolia
```

### 10. Get Test Tokens

For testing on Sepolia:

1. **Get Sepolia ETH**: Use faucets like https://sepoliafaucet.com
2. **Get Test USDT**:
   - Use the Sepolia USDT contract at the address in your config
   - Or deploy your own MockUSDT for testing

## Post-Deployment Checklist

- [ ] All contracts deployed successfully
- [ ] Roles and permissions set correctly
- [ ] Contract addresses updated in frontend
- [ ] Contracts verified on Etherscan
- [ ] Frontend connects to correct network
- [ ] Token purchase flow works
- [ ] Match creation and joining works
- [ ] All transactions appear on Etherscan

## Common Issues and Solutions

### 1. "Insufficient funds for gas"

- **Solution**: Add more Sepolia ETH to your deployment wallet

### 2. "Network mismatch"

- **Solution**: Ensure MetaMask is on Sepolia testnet
- **Solution**: Check RPC URL in hardhat.config.js

### 3. "Contract not found"

- **Solution**: Verify contract addresses in config files
- **Solution**: Ensure contracts are deployed to correct network

### 4. "Transaction reverted"

- **Solution**: Check contract permissions and roles
- **Solution**: Ensure sufficient token approvals

### 5. Frontend not connecting

- **Solution**: Check browser console for errors
- **Solution**: Verify contract ABIs match deployed contracts
- **Solution**: Ensure MetaMask is connected and on correct network

## Production Deployment Notes

When deploying to mainnet:

1. **Update network configuration** in `hardhat.config.js`
2. **Use real USDT contract** address: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
3. **Set proper treasury address** for receiving payments
4. **Test thoroughly** on testnet first
5. **Consider multisig** for admin functions
6. **Implement monitoring** and alerting
7. **Have emergency procedures** ready

## Security Considerations

- [ ] Private keys are secure and not committed to git
- [ ] Treasury address is controlled by appropriate parties
- [ ] Admin roles are assigned to secure accounts
- [ ] Emergency pause functionality tested
- [ ] All critical functions require proper permissions
- [ ] Smart contracts audited before mainnet deployment

## Support

If you encounter issues:

1. Check the console logs in browser developer tools
2. Verify all environment variables are set correctly
3. Ensure you're on the correct network (Sepolia for testnet)
4. Check that contracts are deployed and verified on Etherscan
