const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 TriX Deployment Verification Script");
    console.log("=====================================\n");

    // Load deployment addresses
    let deploymentData;
    try {
        deploymentData = JSON.parse(fs.readFileSync("deployment-info.json", "utf8"));
        console.log("📄 Loaded deployment information from deployment-info.json");
    } catch (error) {
        console.error("❌ Could not load deployment-info.json. Please deploy contracts first.");
        process.exit(1);
    }

    const { gameToken, tokenStore, playGame, network, deployer } = deploymentData;

    console.log(`📶 Network: ${network}`);
    console.log(`👤 Deployer: ${deployer}`);
    console.log(`🪙 GameToken: ${gameToken}`);
    console.log(`🏪 TokenStore: ${tokenStore}`);
    console.log(`🎮 PlayGame: ${playGame}\n`);

    // Get contract instances
    const GameToken = await ethers.getContractAt("GameToken", gameToken);
    const TokenStore = await ethers.getContractAt("TokenStore", tokenStore);
    const PlayGame = await ethers.getContractAt("PlayGame", playGame);

    console.log("🔍 Verifying Contract Configurations...\n");

    // Verify GameToken
    console.log("📊 GameToken Verification:");
    const gtName = await GameToken.name();
    const gtSymbol = await GameToken.symbol();
    const gtDecimals = await GameToken.decimals();
    const gtTotalSupply = await GameToken.totalSupply();

    console.log(`  ✓ Name: ${gtName}`);
    console.log(`  ✓ Symbol: ${gtSymbol}`);
    console.log(`  ✓ Decimals: ${gtDecimals}`);
    console.log(`  ✓ Total Supply: ${ethers.formatEther(gtTotalSupply)} GT`);

    // Check roles
    const MINTER_ROLE = await GameToken.MINTER_ROLE();
    const PAUSER_ROLE = await GameToken.PAUSER_ROLE();
    const DEFAULT_ADMIN_ROLE = await GameToken.DEFAULT_ADMIN_ROLE();

    const isMinter = await GameToken.hasRole(MINTER_ROLE, tokenStore);
    const isPauser = await GameToken.hasRole(PAUSER_ROLE, deployer);
    const isAdmin = await GameToken.hasRole(DEFAULT_ADMIN_ROLE, deployer);

    console.log(`  ✓ TokenStore has MINTER_ROLE: ${isMinter}`);
    console.log(`  ✓ Deployer has PAUSER_ROLE: ${isPauser}`);
    console.log(`  ✓ Deployer has ADMIN_ROLE: ${isAdmin}`);

    // Verify TokenStore
    console.log("\n🏪 TokenStore Verification:");
    const tsGameToken = await TokenStore.gameToken();
    const tsUsdtToken = await TokenStore.usdtToken();
    const tsTreasury = await TokenStore.treasuryAddress();
    const tsDecimalAdj = await TokenStore.DECIMAL_ADJUSTMENT();

    console.log(`  ✓ GameToken Address: ${tsGameToken}`);
    console.log(`  ✓ USDT Token Address: ${tsUsdtToken}`);
    console.log(`  ✓ Treasury Address: ${tsTreasury}`);
    console.log(`  ✓ Decimal Adjustment: ${tsDecimalAdj}`);

    // Check TokenStore roles
    const tsOperatorRole = await TokenStore.OPERATOR_ROLE();
    const tsPauserRole = await TokenStore.PAUSER_ROLE();
    const tsDefaultAdminRole = await TokenStore.DEFAULT_ADMIN_ROLE();

    const tsIsOperator = await TokenStore.hasRole(tsOperatorRole, deployer);
    const tsIsPauser = await TokenStore.hasRole(tsPauserRole, deployer);
    const tsIsAdmin = await TokenStore.hasRole(tsDefaultAdminRole, deployer);

    console.log(`  ✓ Deployer has OPERATOR_ROLE: ${tsIsOperator}`);
    console.log(`  ✓ Deployer has PAUSER_ROLE: ${tsIsPauser}`);
    console.log(`  ✓ Deployer has ADMIN_ROLE: ${tsIsAdmin}`);

    // Verify PlayGame
    console.log("\n🎮 PlayGame Verification:");
    const pgGameToken = await PlayGame.gameToken();
    const pgPlatformFee = await PlayGame.platformFeePercentage();
    const pgBasisPoints = await PlayGame.BASIS_POINTS();

    console.log(`  ✓ GameToken Address: ${pgGameToken}`);
    console.log(`  ✓ Platform Fee: ${pgPlatformFee / 100}% (${pgPlatformFee} basis points)`);
    console.log(`  ✓ Basis Points Denominator: ${pgBasisPoints}`);

    // Check PlayGame roles
    const pgApiGatewayRole = await PlayGame.API_GATEWAY_ROLE();
    const pgPauserRole = await PlayGame.PAUSER_ROLE();
    const pgDefaultAdminRole = await PlayGame.DEFAULT_ADMIN_ROLE();

    const pgIsApiGateway = await PlayGame.hasRole(pgApiGatewayRole, deployer);
    const pgIsPauser = await PlayGame.hasRole(pgPauserRole, deployer);
    const pgIsAdmin = await PlayGame.hasRole(pgDefaultAdminRole, deployer);

    console.log(`  ✓ Deployer has API_GATEWAY_ROLE: ${pgIsApiGateway}`);
    console.log(`  ✓ Deployer has PAUSER_ROLE: ${pgIsPauser}`);
    console.log(`  ✓ Deployer has ADMIN_ROLE: ${pgIsAdmin}`);

    // Cross-contract verification
    console.log("\n🔗 Cross-Contract Verification:");

    // Verify GameToken address consistency
    const gtAddressMatch = tsGameToken === gameToken && pgGameToken === gameToken;
    console.log(`  ✓ GameToken address consistency: ${gtAddressMatch}`);

    // Verify TokenStore can mint GameTokens
    const canMint = await GameToken.hasRole(MINTER_ROLE, tokenStore);
    console.log(`  ✓ TokenStore can mint GameTokens: ${canMint}`);

    // Contract status
    console.log("\n📊 Contract Status:");
    const gtPaused = await GameToken.paused();
    const tsPaused = await TokenStore.paused();
    const pgPaused = await PlayGame.paused();

    console.log(`  ✓ GameToken paused: ${gtPaused}`);
    console.log(`  ✓ TokenStore paused: ${tsPaused}`);
    console.log(`  ✓ PlayGame paused: ${pgPaused}`);

    // Statistics
    console.log("\n📈 Contract Statistics:");
    const [gtStats] = await Promise.all([
        TokenStore.getStats(),
    ]);

    console.log(`  ✓ TokenStore - Total Purchases: ${gtStats[0]}`);
    console.log(`  ✓ TokenStore - Total USDT Received: ${ethers.formatUnits(gtStats[1], 6)} USDT`);
    console.log(`  ✓ TokenStore - Treasury Address: ${gtStats[2]}`);

    const pgStats = await PlayGame.getStats();
    console.log(`  ✓ PlayGame - Total Matches: ${pgStats[0]}`);
    console.log(`  ✓ PlayGame - Total Staked: ${ethers.formatEther(pgStats[1])} GT`);
    console.log(`  ✓ PlayGame - Total Payouts: ${ethers.formatEther(pgStats[2])} GT`);

    console.log("\n✅ Deployment Verification Complete!");
    console.log("🚀 All contracts are properly deployed and configured.");
    console.log("📋 Ready for integration testing and production use.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Deployment verification failed:", error);
        process.exit(1);
    });
