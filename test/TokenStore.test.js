const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenStore", function () {
  let GameToken, TokenStore, MockUSDT;
  let gameToken, tokenStore, mockUSDT;
  let owner, treasury, buyer, user1, user2;
  let addrs;

  const TOKEN_NAME = "TriX Game Token";
  const TOKEN_SYMBOL = "GT";
  const USDT_NAME = "Tether USD";
  const USDT_SYMBOL = "USDT";
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const USDT_DECIMALS = 6;
  const GT_DECIMALS = 18;
  const DECIMAL_ADJUSTMENT = 10 ** (GT_DECIMALS - USDT_DECIMALS);

  beforeEach(async function () {
    [owner, treasury, buyer, user1, user2, ...addrs] = await ethers.getSigners();

    // Deploy GameToken
    GameToken = await ethers.getContractFactory("GameToken");
    gameToken = await GameToken.deploy(INITIAL_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL);
    await gameToken.waitForDeployment();

    // Deploy Mock USDT
    MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    // Deploy TokenStore
    TokenStore = await ethers.getContractFactory("TokenStore");
    tokenStore = await TokenStore.deploy(
      await gameToken.getAddress(),
      await mockUSDT.getAddress(),
      treasury.address
    );
    await tokenStore.waitForDeployment();

    // Grant MINTER_ROLE to TokenStore
    await gameToken.grantRole(await gameToken.MINTER_ROLE(), await tokenStore.getAddress());

    // Mint USDT to buyer for testing
    await mockUSDT.mint(buyer.address, ethers.parseUnits("10000", USDT_DECIMALS));
  });

  describe("Deployment", function () {
    it("Should set the correct addresses", async function () {
      expect(await tokenStore.gameToken()).to.equal(await gameToken.getAddress());
      expect(await tokenStore.usdtToken()).to.equal(await mockUSDT.getAddress());
      expect(await tokenStore.treasuryAddress()).to.equal(treasury.address);
    });

    it("Should grant roles to owner", async function () {
      expect(await tokenStore.hasRole(await tokenStore.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await tokenStore.hasRole(await tokenStore.OPERATOR_ROLE(), owner.address)).to.equal(true);
      expect(await tokenStore.hasRole(await tokenStore.PAUSER_ROLE(), owner.address)).to.equal(true);
    });

    it("Should set correct conversion constants", async function () {
      expect(await tokenStore.CONVERSION_RATE()).to.equal(1);
      expect(await tokenStore.USDT_DECIMALS()).to.equal(USDT_DECIMALS);
      expect(await tokenStore.GT_DECIMALS()).to.equal(GT_DECIMALS);
      expect(await tokenStore.DECIMAL_ADJUSTMENT()).to.equal(DECIMAL_ADJUSTMENT);
    });
  });

  describe("Token Purchase", function () {
    beforeEach(async function () {
      // Approve USDT spending
      await mockUSDT.connect(buyer).approve(await tokenStore.getAddress(), ethers.parseUnits("10000", USDT_DECIMALS));
    });

    it("Should purchase GT tokens with USDT", async function () {
      const usdtAmount = ethers.parseUnits("100", USDT_DECIMALS);
      const expectedGTAmount = usdtAmount * BigInt(DECIMAL_ADJUSTMENT);

      const initialBuyerGT = await gameToken.balanceOf(buyer.address);
      const initialTreasuryUSDT = await mockUSDT.balanceOf(treasury.address);

      await tokenStore.connect(buyer).purchaseTokens(usdtAmount);

      expect(await gameToken.balanceOf(buyer.address)).to.equal(initialBuyerGT + expectedGTAmount);
      expect(await mockUSDT.balanceOf(treasury.address)).to.equal(initialTreasuryUSDT + usdtAmount);
    });

    it("Should emit TokensPurchased event", async function () {
      const usdtAmount = ethers.parseUnits("100", USDT_DECIMALS);
      const expectedGTAmount = usdtAmount * BigInt(DECIMAL_ADJUSTMENT);

      await expect(tokenStore.connect(buyer).purchaseTokens(usdtAmount))
        .to.emit(tokenStore, "TokensPurchased");
    });

    it("Should update purchase statistics", async function () {
      const usdtAmount = ethers.parseUnits("100", USDT_DECIMALS);

      await tokenStore.connect(buyer).purchaseTokens(usdtAmount);

      const stats = await tokenStore.getStats();
      expect(stats[0]).to.equal(1); // totalPurchases
      expect(stats[1]).to.equal(usdtAmount); // totalUSDTReceived
    });

    it("Should not purchase with zero amount", async function () {
      await expect(tokenStore.connect(buyer).purchaseTokens(0))
        .to.be.revertedWith("TokenStore: amount must be greater than 0");
    });

    it("Should not purchase with insufficient USDT balance", async function () {
      const usdtAmount = ethers.parseUnits("20000", USDT_DECIMALS);
      await expect(tokenStore.connect(buyer).purchaseTokens(usdtAmount))
        .to.be.revertedWith("TokenStore: insufficient USDT balance");
    });

    it("Should not purchase with insufficient USDT allowance", async function () {
      const usdtAmount = ethers.parseUnits("100", USDT_DECIMALS);
      await mockUSDT.connect(buyer).approve(await tokenStore.getAddress(), 0);
      await expect(tokenStore.connect(buyer).purchaseTokens(usdtAmount))
        .to.be.revertedWith("TokenStore: insufficient USDT allowance");
    });
  });

  describe("Conversion Calculations", function () {
    it("Should calculate correct GT amount for USDT", async function () {
      const usdtAmount = ethers.parseUnits("100", USDT_DECIMALS);
      const expectedGTAmount = usdtAmount * BigInt(DECIMAL_ADJUSTMENT);

      expect(await tokenStore.getGTAmount(usdtAmount)).to.equal(expectedGTAmount);
    });

    it("Should calculate correct USDT amount for GT", async function () {
      const gtAmount = ethers.parseUnits("100", GT_DECIMALS);
      const expectedUSDTAmount = gtAmount / BigInt(DECIMAL_ADJUSTMENT);

      expect(await tokenStore.getUSDTAmount(gtAmount)).to.equal(expectedUSDTAmount);
    });

    it("Should handle decimal precision correctly", async function () {
      const usdtAmount = ethers.parseUnits("1.5", USDT_DECIMALS);
      const gtAmount = await tokenStore.getGTAmount(usdtAmount);
      const backToUSDT = await tokenStore.getUSDTAmount(gtAmount);

      // Should be close to original amount (within rounding)
      expect(backToUSDT).to.be.closeTo(usdtAmount, ethers.parseUnits("0.1", USDT_DECIMALS));
    });
  });

  describe("Treasury Management", function () {
    it("Should allow admin to update treasury address", async function () {
      const newTreasury = user1.address;
      await tokenStore.updateTreasury(newTreasury);
      expect(await tokenStore.treasuryAddress()).to.equal(newTreasury);
    });

    it("Should emit TreasuryUpdated event", async function () {
      const newTreasury = user1.address;
      await expect(tokenStore.updateTreasury(newTreasury))
        .to.emit(tokenStore, "TreasuryUpdated")
        .withArgs(treasury.address, newTreasury);
    });

    it("Should not allow non-admin to update treasury", async function () {
      const newTreasury = user1.address;
      await expect(tokenStore.connect(user1).updateTreasury(newTreasury))
        .to.be.revertedWithCustomError(tokenStore, "AccessControlUnauthorizedAccount");
    });

    it("Should not set treasury to zero address", async function () {
      await expect(tokenStore.updateTreasury(ethers.ZeroAddress))
        .to.be.revertedWith("TokenStore: invalid treasury address");
    });
  });

  describe("Pausing", function () {
    it("Should allow pauser to pause", async function () {
      await tokenStore.pause();
      expect(await tokenStore.isPaused()).to.equal(true);
    });

    it("Should not allow non-pauser to pause", async function () {
      await expect(tokenStore.connect(user1).pause())
        .to.be.revertedWithCustomError(tokenStore, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow purchases when paused", async function () {
      await tokenStore.pause();
      await mockUSDT.connect(buyer).approve(await tokenStore.getAddress(), ethers.parseUnits("100", USDT_DECIMALS));

      await expect(tokenStore.connect(buyer).purchaseTokens(ethers.parseUnits("100", USDT_DECIMALS)))
        .to.be.reverted;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to withdraw tokens", async function () {
      // Mint and transfer some tokens to contract
      await mockUSDT.mint(owner.address, ethers.parseUnits("100", USDT_DECIMALS));
      await mockUSDT.transfer(await tokenStore.getAddress(), ethers.parseUnits("100", USDT_DECIMALS));

      await tokenStore.emergencyWithdraw(
        await mockUSDT.getAddress(),
        user1.address,
        ethers.parseUnits("100", USDT_DECIMALS)
      );

      expect(await mockUSDT.balanceOf(user1.address)).to.equal(ethers.parseUnits("100", USDT_DECIMALS));
    });

    it("Should emit EmergencyWithdraw event", async function () {
      await mockUSDT.mint(owner.address, ethers.parseUnits("100", USDT_DECIMALS));
      await mockUSDT.transfer(await tokenStore.getAddress(), ethers.parseUnits("100", USDT_DECIMALS));

      await expect(tokenStore.emergencyWithdraw(
        await mockUSDT.getAddress(),
        user1.address,
        ethers.parseUnits("100", USDT_DECIMALS)
      ))
        .to.emit(tokenStore, "EmergencyWithdraw")
        .withArgs(await mockUSDT.getAddress(), user1.address, ethers.parseUnits("100", USDT_DECIMALS));
    });

    it("Should not allow non-admin to withdraw tokens", async function () {
      await expect(tokenStore.connect(user1).emergencyWithdraw(
        await mockUSDT.getAddress(),
        user2.address,
        ethers.parseUnits("100", USDT_DECIMALS)
      )).to.be.revertedWithCustomError(tokenStore, "AccessControlUnauthorizedAccount");
    });

    it("Should allow admin to withdraw ETH", async function () {
      // Send ETH to contract
      await owner.sendTransaction({
        to: await tokenStore.getAddress(),
        value: ethers.parseEther("1")
      });

      await tokenStore.emergencyWithdrawETH(user1.address, ethers.parseEther("1"));
      expect(await ethers.provider.getBalance(user1.address)).to.be.gt(0);
    });
  });

  describe("Statistics", function () {
    it("Should return correct statistics", async function () {
      await mockUSDT.connect(buyer).approve(await tokenStore.getAddress(), ethers.parseUnits("1000", USDT_DECIMALS));

      await tokenStore.connect(buyer).purchaseTokens(ethers.parseUnits("100", USDT_DECIMALS));
      await tokenStore.connect(buyer).purchaseTokens(ethers.parseUnits("200", USDT_DECIMALS));

      const stats = await tokenStore.getStats();
      expect(stats[0]).to.equal(2); // totalPurchases
      expect(stats[1]).to.equal(ethers.parseUnits("300", USDT_DECIMALS)); // totalUSDTReceived
      expect(stats[2]).to.equal(treasury.address); // treasuryAddress
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrant calls to purchase", async function () {
      await mockUSDT.connect(buyer).approve(await tokenStore.getAddress(), ethers.parseUnits("100", USDT_DECIMALS));
      await expect(tokenStore.connect(buyer).purchaseTokens(ethers.parseUnits("100", USDT_DECIMALS))).to.not.be.reverted;
    });
  });
});

// Helper function to get current timestamp
async function time() {
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  return block.timestamp;
}


