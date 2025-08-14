# 🚀 TriX Deployment Guide

## Overview

This guide will help you deploy the TriX blockchain gaming platform to production using free tier services.

## 🎯 Deployment Architecture

### Frontend: Vercel (Free)

- **URL**: `https://your-app.vercel.app`
- **Features**: CDN, automatic deployments, custom domains

### Backend API: Render (Free)

- **URL**: `https://trix-api.onrender.com`
- **Features**: Node.js hosting, environment variables

### Leaderboard Service: Render (Free)

- **URL**: `https://trix-leaderboard.onrender.com`
- **Features**: Event listening, real-time updates

### Blockchain: Sepolia Testnet (Free)

- **Network**: Ethereum Sepolia
- **Features**: Free test ETH, real blockchain environment

## 📋 Prerequisites

1. **GitHub Account** (for code hosting)
2. **Vercel Account** (free tier)
3. **Render Account** (free tier)
4. **MetaMask Wallet** (for blockchain interaction)
5. **Sepolia Testnet ETH** (free from faucets)

## 🚀 Step-by-Step Deployment

### 1. Prepare Your Repository

```bash
# Ensure all files are committed
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Deploy Smart Contracts to Sepolia

#### A. Get Sepolia Testnet ETH

- Visit [Sepolia Faucet](https://sepoliafaucet.com/)
- Enter your wallet address
- Receive free test ETH

#### B. Configure Hardhat for Sepolia

```bash
# Install dependencies
npm install

# Create .env file with your private key
echo "PRIVATE_KEY=your_wallet_private_key_here" > .env
echo "SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID" >> .env
```

#### C. Deploy Contracts

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

#### D. Save Contract Addresses

After deployment, save the contract addresses for the next steps.

### 3. Deploy Backend to Render

#### A. Create Render Account

- Visit [render.com](https://render.com)
- Sign up with GitHub

#### B. Deploy API Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `trix-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node api/index.js`
   - **Plan**: Free

#### C. Set Environment Variables

Add these environment variables in Render:

```
NODE_ENV=production
PORT=3000
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
PRIVATE_KEY=your_wallet_private_key_here
GAMETOKEN_ADDR=0x... (from deployment)
TOKENSTORE_ADDR=0x... (from deployment)
PLAYGAME_ADDR=0x... (from deployment)
MOCKUSDT_ADDR=0x... (from deployment)
```

#### D. Deploy Leaderboard Service

1. Click "New +" → "Web Service"
2. Same repository, different configuration:
   - **Name**: `trix-leaderboard`
   - **Start Command**: `node tools/leaderboard.js`
   - **Port**: `3001`

### 4. Deploy Frontend to Vercel

#### A. Create Vercel Account

- Visit [vercel.com](https://vercel.com)
- Sign up with GitHub

#### B. Deploy Frontend

1. Click "New Project"
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: `echo "No build required"`
   - **Output Directory**: `web`

#### C. Set Environment Variables (Optional)

If you want to make URLs configurable:

```
NEXT_PUBLIC_API_URL=https://trix-api.onrender.com
NEXT_PUBLIC_LEADERBOARD_URL=https://trix-leaderboard.onrender.com
```

### 5. Configure MetaMask

#### A. Add Sepolia Network

- Network Name: `Sepolia Testnet`
- RPC URL: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`
- Chain ID: `11155111`
- Currency Symbol: `ETH`

#### B. Get Test Tokens

- Visit [Sepolia Faucet](https://sepoliafaucet.com/)
- Get test ETH for gas fees

## 🔧 Post-Deployment Configuration

### 1. Update Frontend URLs

The frontend is already configured to use the deployed backend URLs:

- API: `https://trix-api.onrender.com`
- Leaderboard: `https://trix-leaderboard.onrender.com`

### 2. Test the Application

1. Visit your Vercel frontend URL
2. Connect MetaMask (Sepolia network)
3. Test all features:
   - Token purchase
   - Match creation
   - Staking
   - Result declaration
   - Leaderboard

### 3. Monitor Services

- **Render Dashboard**: Monitor API and leaderboard services
- **Vercel Dashboard**: Monitor frontend performance
- **Hardhat**: Check contract interactions

## 🆘 Troubleshooting

### Common Issues

#### 1. CORS Errors

- Ensure CORS is enabled in backend
- Check that frontend URLs are correct

#### 2. Contract Interaction Failures

- Verify MetaMask is on Sepolia network
- Check contract addresses are correct
- Ensure wallet has test ETH for gas

#### 3. Backend Service Issues

- Check Render logs for errors
- Verify environment variables
- Ensure RPC URL is accessible

#### 4. Leaderboard Not Updating

- Check leaderboard service logs
- Verify event listeners are working
- Check blockchain connection

### Debug Commands

```bash
# Check backend health
curl https://trix-api.onrender.com/health

# Check leaderboard
curl https://trix-leaderboard.onrender.com/leaderboard

# Test frontend
curl https://your-app.vercel.app
```

## 📊 Monitoring & Maintenance

### 1. Service Health Checks

- Set up monitoring for all services
- Configure alerts for downtime
- Monitor error rates

### 2. Performance Optimization

- Enable caching where possible
- Optimize database queries
- Monitor gas usage

### 3. Security Considerations

- Keep private keys secure
- Use environment variables
- Regular security updates

## 🎉 Success!

Your TriX blockchain gaming platform is now live! Users can:

- Connect their MetaMask wallets
- Purchase game tokens
- Create and participate in matches
- View real-time leaderboards
- Experience Web3 gaming

## 🔄 Updates & Maintenance

### Frontend Updates

- Push to GitHub
- Vercel auto-deploys

### Backend Updates

- Push to GitHub
- Render auto-deploys

### Smart Contract Updates

- Deploy new contracts
- Update environment variables
- Migrate data if needed

---

**Need Help?** Check the troubleshooting section or create an issue in the repository.
