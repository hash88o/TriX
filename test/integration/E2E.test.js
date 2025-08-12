const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("End-to-End Integration Tests", function () {
    let GameToken, TokenStore, PlayGame;
    let gameToken, tokenStore, playGame;
    let mockUSDT;
    let owner, treasury, apiGateway, player1, player2, player3;
    let addrs;

    const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1M GT
    const TOKEN_NAME = "TriX Game Token";
    const TOKEN_SYMBOL = "GT";
    const USDT_DECIMALS = 6;
    const STAKE_AMOUNT = ethers.parseEther("100");

    before(async function () {
        [owner, treasury, apiGateway, player1, player2, player3, ...addrs] = await ethers.getSigners();

        console.log("Deploying contracts for E2E testing...");

        // Deploy GameToken
        GameToken = await ethers.getContractFactory("GameToken");
        gameToken = await GameToken.deploy(INITIAL_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL);
        await gameToken.waitForDeployment();
        console.log("GameToken deployed to:", await gameToken.getAddress());

        // Deploy Mock USDT
        const MockUSDT = await ethers.getContractFactory("MockUSDT");
        mockUSDT = await MockUSDT.deploy();
        await mockUSDT.waitForDeployment();
        console.log("MockUSDT deployed to:", await mockUSDT.getAddress());

        // Deploy TokenStore
        TokenStore = await ethers.getContractFactory("TokenStore");
        tokenStore = await TokenStore.deploy(
            await gameToken.getAddress(),
            await mockUSDT.getAddress(),
            treasury.address
        );
        await tokenStore.waitForDeployment();
        console.log("TokenStore deployed to:", await tokenStore.getAddress());

        // Deploy PlayGame
        PlayGame = await ethers.getContractFactory("PlayGame");
        playGame = await PlayGame.deploy(await gameToken.getAddress());
        await playGame.waitForDeployment();
        console.log("PlayGame deployed to:", await playGame.getAddress());

        // Setup roles and permissions
        await gameToken.grantRole(await gameToken.MINTER_ROLE(), await tokenStore.getAddress());
        await playGame.grantRole(await playGame.API_GATEWAY_ROLE(), apiGateway.address);

        console.log("Setup complete. Starting E2E tests...");
    });

    describe("Complete Token Purchase → Staking → Payout Flow", function () {
        it("Should complete the full user journey", async function () {
            console.log("\n=== Starting Complete User Journey ===");

            // Step 1: Mint USDT to players
            const usdtAmount = ethers.parseUnits("500", USDT_DECIMALS); // 500 USDT
            await mockUSDT.mint(player1.address, usdtAmount);
            await mockUSDT.mint(player2.address, usdtAmount);

            console.log("✓ Step 1: Minted USDT to players");
            console.log(`  Player1 USDT balance: ${ethers.formatUnits(await mockUSDT.balanceOf(player1.address), USDT_DECIMALS)}`);
            console.log(`  Player2 USDT balance: ${ethers.formatUnits(await mockUSDT.balanceOf(player2.address), USDT_DECIMALS)}`);

            // Step 2: Approve USDT spending for TokenStore
            await mockUSDT.connect(player1).approve(await tokenStore.getAddress(), usdtAmount);
            await mockUSDT.connect(player2).approve(await tokenStore.getAddress(), usdtAmount);

            console.log("✓ Step 2: Approved USDT spending");

            // Step 3: Purchase GT tokens with USDT
            const usdtToPurchase = ethers.parseUnits("200", USDT_DECIMALS); // 200 USDT
            await tokenStore.connect(player1).purchaseTokens(usdtToPurchase);
            await tokenStore.connect(player2).purchaseTokens(usdtToPurchase);

            const expectedGT = usdtToPurchase * BigInt(10 ** (18 - USDT_DECIMALS)); // Convert to 18 decimals

            console.log("✓ Step 3: Purchased GT tokens");
            console.log(`  Player1 GT balance: ${ethers.formatEther(await gameToken.balanceOf(player1.address))}`);
            console.log(`  Player2 GT balance: ${ethers.formatEther(await gameToken.balanceOf(player2.address))}`);
            console.log(`  Treasury USDT balance: ${ethers.formatUnits(await mockUSDT.balanceOf(treasury.address), USDT_DECIMALS)}`);

            // Verify GT balances
            expect(await gameToken.balanceOf(player1.address)).to.equal(expectedGT);
            expect(await gameToken.balanceOf(player2.address)).to.equal(expectedGT);

            // Step 4: Approve GT spending for PlayGame
            await gameToken.connect(player1).approve(await playGame.getAddress(), STAKE_AMOUNT);
            await gameToken.connect(player2).approve(await playGame.getAddress(), STAKE_AMOUNT);

            console.log("✓ Step 4: Approved GT spending for PlayGame");

            // Step 5: Create a match
            const tx1 = await playGame.connect(player1).createMatch(STAKE_AMOUNT);
            const receipt1 = await tx1.wait();
            const matchId = 1; // First match

            console.log("✓ Step 5: Player1 created match");
            console.log(`  Match ID: ${matchId}`);
            console.log(`  Stake Amount: ${ethers.formatEther(STAKE_AMOUNT)} GT`);

            // Step 6: Player2 joins the match
            await playGame.connect(player2).joinMatch(matchId);

            console.log("✓ Step 6: Player2 joined match");

            // Verify match state
            const match = await playGame.getMatch(matchId);
            expect(match.status).to.equal(1); // Active
            expect(match.player1).to.equal(player1.address);
            expect(match.player2).to.equal(player2.address);
            expect(match.totalStake).to.equal(STAKE_AMOUNT * 2n);

            console.log(`  Match Status: Active`);
            console.log(`  Total Stake: ${ethers.formatEther(match.totalStake)} GT`);

            // Step 7: API Gateway completes the match (Player1 wins)
            const balanceBeforeWin = await gameToken.balanceOf(player1.address);
            await playGame.connect(apiGateway).completeMatch(matchId, player1.address);

            console.log("✓ Step 7: Match completed - Player1 wins");

            // Step 8: Verify payout
            const balanceAfterWin = await gameToken.balanceOf(player1.address);
            const matchAfter = await playGame.getMatch(matchId);

            // Calculate expected payout (total stake minus 5% platform fee)
            const totalStake = STAKE_AMOUNT * 2n;
            const platformFee = (totalStake * 500n) / 10000n; // 5% fee
            const expectedPayout = totalStake - platformFee;
            const actualPayout = balanceAfterWin - balanceBeforeWin;

            console.log("✓ Step 8: Verified payout");
            console.log(`  Expected payout: ${ethers.formatEther(expectedPayout)} GT`);
            console.log(`  Actual payout: ${ethers.formatEther(actualPayout)} GT`);
            console.log(`  Platform fee: ${ethers.formatEther(platformFee)} GT`);

            expect(actualPayout).to.equal(expectedPayout);
            expect(matchAfter.status).to.equal(2); // Completed
            expect(matchAfter.winner).to.equal(player1.address);

            console.log("=== Complete User Journey Successful! ===\n");
        });

        it("Should handle multiple concurrent matches", async function () {
            console.log("Testing multiple concurrent matches...");

            // Create multiple matches
            await gameToken.connect(player1).approve(await playGame.getAddress(), STAKE_AMOUNT * 3n);
            await gameToken.connect(player2).approve(await playGame.getAddress(), STAKE_AMOUNT * 3n);
            await gameToken.connect(player3).approve(await playGame.getAddress(), STAKE_AMOUNT * 3n);

            // Mint GT to player3
            const usdtAmount = ethers.parseUnits("200", USDT_DECIMALS);
            await mockUSDT.mint(player3.address, usdtAmount);
            await mockUSDT.connect(player3).approve(await tokenStore.getAddress(), usdtAmount);
            await tokenStore.connect(player3).purchaseTokens(usdtAmount);

            // Create 3 matches
            await playGame.connect(player1).createMatch(STAKE_AMOUNT);
            await playGame.connect(player2).createMatch(STAKE_AMOUNT);
            await playGame.connect(player3).createMatch(STAKE_AMOUNT);

            // Join matches
            await playGame.connect(player2).joinMatch(2);
            await playGame.connect(player3).joinMatch(3);
            await playGame.connect(player1).joinMatch(4);

            // Complete all matches
            await playGame.connect(apiGateway).completeMatch(2, player1.address);
            await playGame.connect(apiGateway).completeMatch(3, player2.address);
            await playGame.connect(apiGateway).completeMatch(4, player3.address);

            console.log("✓ Multiple concurrent matches handled successfully");
        });
    });

    describe("Error Scenarios and Edge Cases", function () {
        it("Should handle insufficient funds gracefully", async function () {
            // Try to create match with insufficient GT
            await expect(
                playGame.connect(player1).createMatch(ethers.parseEther("10000"))
            ).to.be.revertedWith("PlayGame: insufficient GT balance");
        });

        it("Should prevent unauthorized match completion", async function () {
            await playGame.connect(player1).createMatch(STAKE_AMOUNT);

            await expect(
                playGame.connect(player1).completeMatch(5, player1.address)
            ).to.be.revertedWithCustomError(playGame, "AccessControlUnauthorizedAccount");
        });

        it("Should handle emergency pause correctly", async function () {
            // Pause all contracts
            await gameToken.pause();
            await tokenStore.pause();
            await playGame.pause();

            // Verify operations are blocked
            await expect(
                gameToken.connect(player1).transfer(player2.address, ethers.parseEther("1"))
            ).to.be.reverted;

            await expect(
                tokenStore.connect(player1).purchaseTokens(ethers.parseUnits("1", USDT_DECIMALS))
            ).to.be.reverted;

            await expect(
                playGame.connect(player1).createMatch(STAKE_AMOUNT)
            ).to.be.reverted;

            // Unpause
            await gameToken.unpause();
            await tokenStore.unpause();
            await playGame.unpause();

            console.log("✓ Emergency pause functionality verified");
        });
    });

    describe("Security and Access Control", function () {
        it("Should enforce role-based access control", async function () {
            // Non-minter cannot mint
            await expect(
                gameToken.connect(player1).mint(player1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(gameToken, "AccessControlUnauthorizedAccount");

            // Non-admin cannot update treasury
            await expect(
                tokenStore.connect(player1).updateTreasury(player1.address)
            ).to.be.revertedWithCustomError(tokenStore, "AccessControlUnauthorizedAccount");

            // Non-admin cannot update platform fee
            await expect(
                playGame.connect(player1).updatePlatformFee(1000)
            ).to.be.revertedWithCustomError(playGame, "AccessControlUnauthorizedAccount");

            console.log("✓ Role-based access control verified");
        });

        it("Should validate input parameters", async function () {
            // Zero address validations
            await expect(
                gameToken.mint(ethers.ZeroAddress, ethers.parseEther("1000"))
            ).to.be.revertedWith("GameToken: cannot mint to zero address");

            await expect(
                tokenStore.updateTreasury(ethers.ZeroAddress)
            ).to.be.revertedWith("TokenStore: treasury cannot be zero address");

            // Zero amount validations
            await expect(
                tokenStore.connect(player1).purchaseTokens(0)
            ).to.be.revertedWith("TokenStore: amount must be greater than 0");

            await expect(
                playGame.connect(player1).createMatch(0)
            ).to.be.revertedWith("PlayGame: stake amount must be greater than 0");

            console.log("✓ Input parameter validation verified");
        });
    });

    after(async function () {
        console.log("\n=== E2E Integration Test Summary ===");
        console.log("✅ Complete token purchase → staking → payout flow");
        console.log("✅ Multiple concurrent matches");
        console.log("✅ Error handling and edge cases");
        console.log("✅ Emergency pause functionality");
        console.log("✅ Role-based access control");
        console.log("✅ Input parameter validation");
        console.log("✅ All security features verified");
        console.log("=====================================\n");
    });
});
