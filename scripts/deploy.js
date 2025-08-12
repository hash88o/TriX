const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Configuration
  const TOKEN_NAME = "TriX Game Token";
  const TOKEN_SYMBOL = "GT";
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1 million tokens
  
  // For mainnet, use actual USDT address
  // For testnet, you'll need to deploy a mock USDT or use existing testnet USDT
  const USDT_ADDRESS = process.env.USDT_ADDRESS || "0x0000000000000000000000000000000000000000";
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;

  console.log("\n=== Deploying TriX Smart Contracts ===\n");

  // 1. Deploy GameToken
  console.log("1. Deploying GameToken...");
  const GameToken = await ethers.getContractFactory("GameToken");
  const gameToken = await GameToken.deploy(INITIAL_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL);
  await gameToken.waitForDeployment();
  console.log("   GameToken deployed to:", await gameToken.getAddress());
  console.log("   Initial supply:", ethers.formatEther(INITIAL_SUPPLY), "GT");

  // 2. Deploy TokenStore
  console.log("\n2. Deploying TokenStore...");
  const TokenStore = await ethers.getContractFactory("TokenStore");
  const tokenStore = await TokenStore.deploy(
    await gameToken.getAddress(),
    USDT_ADDRESS,
    TREASURY_ADDRESS
  );
  await tokenStore.waitForDeployment();
  console.log("   TokenStore deployed to:", await tokenStore.getAddress());
  console.log("   USDT Address:", USDT_ADDRESS);
  console.log("   Treasury Address:", TREASURY_ADDRESS);

  // 3. Deploy PlayGame
  console.log("\n3. Deploying PlayGame...");
  const PlayGame = await ethers.getContractFactory("PlayGame");
  const playGame = await PlayGame.deploy(await gameToken.getAddress());
  await playGame.waitForDeployment();
  console.log("   PlayGame deployed to:", await playGame.getAddress());

  // 4. Setup roles and permissions
  console.log("\n4. Setting up roles and permissions...");
  
  // Grant MINTER_ROLE to TokenStore
  const MINTER_ROLE = await gameToken.MINTER_ROLE();
  await gameToken.grantRole(MINTER_ROLE, await tokenStore.getAddress());
  console.log("   ✓ Granted MINTER_ROLE to TokenStore");

  // Grant API_GATEWAY_ROLE to deployer (will be transferred to actual API Gateway)
  const API_GATEWAY_ROLE = await playGame.API_GATEWAY_ROLE();
  await playGame.grantRole(API_GATEWAY_ROLE, deployer.address);
  console.log("   ✓ Granted API_GATEWAY_ROLE to deployer");

  // 5. Verify initial setup
  console.log("\n5. Verifying initial setup...");
  
  const deployerBalance = await gameToken.balanceOf(deployer.address);
  console.log("   Deployer GT balance:", ethers.formatEther(deployerBalance));
  
  const tokenStoreMinterRole = await gameToken.hasRole(MINTER_ROLE, await tokenStore.getAddress());
  console.log("   TokenStore has MINTER_ROLE:", tokenStoreMinterRole);
  
  const playGameApiRole = await playGame.hasRole(API_GATEWAY_ROLE, deployer.address);
  console.log("   Deployer has API_GATEWAY_ROLE:", playGameApiRole);

  // 6. Output deployment summary
  console.log("\n=== Deployment Summary ===");
  console.log("Network:", network.name);
  console.log("Deployer:", deployer.address);
  console.log("GameToken:", await gameToken.getAddress());
  console.log("TokenStore:", await tokenStore.getAddress());
  console.log("PlayGame:", await playGame.getAddress());
  console.log("USDT Address:", USDT_ADDRESS);
  console.log("Treasury Address:", TREASURY_ADDRESS);
  console.log("Initial GT Supply:", ethers.formatEther(INITIAL_SUPPLY));

  // 7. Save deployment addresses for verification
  const deploymentInfo = {
    network: network.name,
    deployer: deployer.address,
    contracts: {
      GameToken: await gameToken.getAddress(),
      TokenStore: await tokenStore.getAddress(),
      PlayGame: await playGame.getAddress()
    },
    configuration: {
      USDT_ADDRESS: USDT_ADDRESS,
      TREASURY_ADDRESS: TREASURY_ADDRESS,
      INITIAL_SUPPLY: INITIAL_SUPPLY.toString(),
      TOKEN_NAME: TOKEN_NAME,
      TOKEN_SYMBOL: TOKEN_SYMBOL
    },
    roles: {
      MINTER_ROLE: MINTER_ROLE,
      API_GATEWAY_ROLE: API_GATEWAY_ROLE
    },
    deploymentTime: new Date().toISOString()
  };

  // Save to file
  const fs = require("fs");
  const deploymentPath = `deployments/${network.name}.json`;
  
  // Create deployments directory if it doesn't exist
  if (!fs.existsSync("deployments")) {
    fs.mkdirSync("deployments");
  }
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentPath}`);

  console.log("\n=== Next Steps ===");
  console.log("1. Verify contracts on Etherscan (if on public network)");
  console.log("2. Transfer API_GATEWAY_ROLE to your API Gateway service");
  console.log("3. Update USDT_ADDRESS for mainnet deployment");
  console.log("4. Set up monitoring and alerting");
  console.log("5. Test the complete flow on testnet first");

  return {
    gameToken: await gameToken.getAddress(),
    tokenStore: await tokenStore.getAddress(),
    playGame: await playGame.getAddress()
  };
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
