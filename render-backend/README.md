# TriX Backend for Render Deployment

This backend provides both REST API and WebSocket functionality for the TriX Gaming Platform.

## 🚀 **Deploy to Render**

### **Step 1: Create Render Account**

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Verify your email

### **Step 2: Create New Web Service**

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Select the `render-backend` folder

### **Step 3: Configure Service**

- **Name:** `trix-backend`
- **Environment:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Plan:** Free (or paid if you prefer)

### **Step 4: Add Environment Variables**

In your Render service settings, add these environment variables:

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
TREASURY_ADDRESS=YOUR_WALLET_ADDRESS_HERE
GAMETOKEN_ADDR=0x7740aF6224458cd62CEDC93f3E47735d3628Aa23
TOKENSTORE_ADDR=0x574c85CBB55533f75894613D1869AC0EBC515156
PLAYGAME_ADDR=0xa3eE2EF1A305105445006E97d970443A063E76DD
MOCKUSDT_ADDR=0x9620fEfD83D6038f80148A686E3258C2E15dEE96
PORT=3000
NODE_ENV=production
```

### **Step 5: Deploy**

1. Click **"Create Web Service"**
2. Wait for deployment (usually 2-5 minutes)
3. Get your Render URL (e.g., `https://trix-backend.onrender.com`)

## 🔧 **Update Frontend**

After deployment, update your frontend to use the new Render backend:

```javascript
// In your frontend, change the WebSocket URL to:
const MATCHMAKING_URL = "https://trix-backend.onrender.com";
```

## 📊 **Features**

- ✅ **REST API** - Health, balances, match operations
- ✅ **WebSocket** - Real-time matchmaking
- ✅ **Blockchain Integration** - Sepolia testnet
- ✅ **Game Logic** - Tic-tac-toe with win detection
- ✅ **CORS Enabled** - Works with Vercel frontend

## 🌐 **API Endpoints**

- `GET /health` - Service health check
- `GET /balances/:address` - Get ETH and GT balances
- `POST /buy-gt` - Buy GT tokens with USDT
- `POST /faucet` - Get test USDT
- `POST /match/start` - Create new match
- `POST /match/result` - Submit match result
- `GET /stats` - Matchmaking statistics

## 🔌 **WebSocket Events**

- `findMatch` - Join matchmaking queue
- `playerStaked` - Player stakes in match
- `makeMove` - Make game move
- `cancelMatchmaking` - Cancel matchmaking

## 💰 **Render Free Tier**

- **Always on** (no sleeping)
- **750 hours/month** (enough for full month)
- **WebSocket support** ✅
- **Custom domains** available
- **Auto-scaling** based on traffic

## 🎯 **Result**

You'll have a fully functional backend with:

- Real-time WebSocket matchmaking
- Blockchain integration
- Always-on availability
- Professional hosting
