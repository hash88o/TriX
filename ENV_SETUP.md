# TriX Environment Setup Guide

## Required Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ==== PRIVATE KEYS (NEVER COMMIT TO GIT) ====
PRIVATE_KEY=your_private_key_here_without_0x_prefix

# ==== NETWORK RPC URLs ====
# Get these from Alchemy, Infura, or other providers
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
MAINNET_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY

# ==== API KEYS ====
ALCHEMY_API_KEY=your_alchemy_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key

# ==== CONTRACT ADDRESSES ====
# Sepolia Testnet USDT (or use a mock USDT you deploy)
USDT_ADDRESS=0x7169D38820dfd117C3FA1f22a697dBA58d90BA06

# Your treasury wallet address (where USDT payments go)
TREASURY_ADDRESS=your_treasury_wallet_address

# ==== GAS SETTINGS ====
GAS_LIMIT=5000000
GAS_PRICE=20000000000

# ==== FRONTEND SETTINGS ====
REACT_APP_NETWORK=sepolia
REACT_APP_GAMETOKEN_ADDRESS=will_be_set_after_deployment
REACT_APP_TOKENSTORE_ADDRESS=will_be_set_after_deployment
REACT_APP_PLAYGAME_ADDRESS=will_be_set_after_deployment
```

## How to Get API Keys:

### 1. Alchemy (Recommended)

- Go to https://alchemy.com
- Sign up and create a new app
- Select "Ethereum" and "Sepolia" for testnet
- Copy the API key from your dashboard

### 2. Etherscan

- Go to https://etherscan.io
- Create account and go to API Keys section
- Create a new API key for contract verification

### 3. CoinMarketCap (Optional)

- Go to https://coinmarketcap.com/api/
- Sign up for free API access for gas price reporting

### 4. Private Key

- Export from MetaMask: Account menu → Account details → Export private key
- **NEVER SHARE OR COMMIT THIS TO GIT**

## Security Notes:

- Add `.env` to your `.gitignore` file
- Never commit private keys to version control
- Use separate wallets for testnet and mainnet
- Keep private keys secure and backed up
