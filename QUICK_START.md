# ⚡ Quick Start - Deploy TriX in 10 Minutes

## 🚀 Ultra-Fast Deployment

### 1. Prepare Your Environment (2 minutes)

```bash
# Clone or prepare your repository
git add .
git commit -m "Ready for deployment"
git push origin main

# Create .env file
echo "PRIVATE_KEY=your_wallet_private_key_here" > .env
echo "SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID" >> .env
```

### 2. Deploy Smart Contracts (3 minutes)

```bash
# Install dependencies
npm install

# Deploy to Sepolia
npx hardhat run scripts/deploy.js --network sepolia
```

**Save the contract addresses!** You'll need them for the next step.

### 3. Deploy Backend to Render (3 minutes)

1. **Visit [render.com](https://render.com)**
2. **Sign up with GitHub**
3. **Click "New +" → "Web Service"**
4. **Connect your repository**
5. **Configure:**

   - Name: `trix-api`
   - Build Command: `npm install`
   - Start Command: `node api/index.js`
   - Plan: Free

6. **Add Environment Variables:**

   ```
   NODE_ENV=production
   PORT=3000
   RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
   PRIVATE_KEY=your_wallet_private_key_here
   GAMETOKEN_ADDR=0x... (from step 2)
   TOKENSTORE_ADDR=0x... (from step 2)
   PLAYGAME_ADDR=0x... (from step 2)
   MOCKUSDT_ADDR=0x... (from step 2)
   ```

7. **Deploy Leaderboard Service:**
   - Same repository
   - Name: `trix-leaderboard`
   - Start Command: `node tools/leaderboard.js`
   - Port: `3001`

### 4. Deploy Frontend to Vercel (2 minutes)

1. **Visit [vercel.com](https://vercel.com)**
2. **Sign up with GitHub**
3. **Click "New Project"**
4. **Import your repository**
5. **Configure:**

   - Framework Preset: Other
   - Root Directory: `./`
   - Build Command: `echo "No build required"`
   - Output Directory: `web`

6. **Deploy!**

## 🎯 Your App is Live!

- **Frontend**: `https://your-app.vercel.app`
- **API**: `https://trix-api.onrender.com`
- **Leaderboard**: `https://trix-leaderboard.onrender.com`

## 🔧 Quick Configuration

### MetaMask Setup

1. Add Sepolia Network:

   - Network Name: `Sepolia Testnet`
   - RPC URL: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
   - Chain ID: `11155111`
   - Currency: `ETH`

2. Get Test ETH:
   - Visit [Sepolia Faucet](https://sepoliafaucet.com/)
   - Enter your wallet address
   - Receive free test ETH

### Test Your App

1. Visit your Vercel URL
2. Connect MetaMask (Sepolia network)
3. Test all features:
   - ✅ Token purchase
   - ✅ Match creation
   - ✅ Staking
   - ✅ Result declaration
   - ✅ Leaderboard

## 🆘 Need Help?

- **Detailed Guide**: See `DEPLOYMENT.md`
- **Troubleshooting**: Check service logs in Render/Vercel
- **Issues**: Create GitHub issue

## 🎉 Success!

Your TriX blockchain gaming platform is now live and ready for users!

---

**Time to deploy: ~10 minutes** ⚡
