#!/bin/bash

echo "🚀 TriX Deployment Script"
echo "=========================="

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found. Please initialize git first:"
    echo "   git init"
    echo "   git add ."
    echo "   git commit -m 'Initial commit'"
    echo "   git remote add origin YOUR_GITHUB_REPO_URL"
    echo "   git push -u origin main"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create one with:"
    echo "   PRIVATE_KEY=your_wallet_private_key"
    echo "   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Deploy contracts to Sepolia
echo "🔗 Deploying smart contracts to Sepolia..."
npx hardhat run scripts/deploy.js --network sepolia

echo ""
echo "🎉 Deployment steps completed!"
echo ""
echo "📋 Next steps:"
echo "1. Save the contract addresses from above"
echo "2. Deploy backend to Render:"
echo "   - Visit https://render.com"
echo "   - Create new Web Service"
echo "   - Connect your GitHub repo"
echo "   - Set environment variables"
echo ""
echo "3. Deploy frontend to Vercel:"
echo "   - Visit https://vercel.com"
echo "   - Import your GitHub repo"
echo "   - Deploy"
echo ""
echo "4. Configure MetaMask for Sepolia network"
echo "5. Get test ETH from https://sepoliafaucet.com"
echo ""
echo "📖 See DEPLOYMENT.md for detailed instructions"
