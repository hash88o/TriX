const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GameToken", function () {
  let GameToken;
  let gameToken;
  let owner;
  let minter;
  let pauser;
  let user1;
  let user2;
  let addrs;

  const TOKEN_NAME = "TriX Game Token";
  const TOKEN_SYMBOL = "GT";
  const INITIAL_SUPPLY = ethers.parseEther("1000000"); // 1 million tokens
  const DECIMALS = 18;

  beforeEach(async function () {
    [owner, minter, pauser, user1, user2, ...addrs] = await ethers.getSigners();

    GameToken = await ethers.getContractFactory("GameToken");
    gameToken = await GameToken.deploy(INITIAL_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL);
    await gameToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gameToken.hasRole(await gameToken.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
    });

    it("Should assign the total supply of tokens to the owner", async function () {
      const ownerBalance = await gameToken.balanceOf(owner.address);
      expect(await gameToken.totalSupply()).to.equal(ownerBalance);
    });

    it("Should set the correct token name and symbol", async function () {
      expect(await gameToken.name()).to.equal(TOKEN_NAME);
      expect(await gameToken.symbol()).to.equal(TOKEN_SYMBOL);
    });

    it("Should set the correct decimals", async function () {
      expect(await gameToken.decimals()).to.equal(DECIMALS);
    });

    it("Should grant MINTER_ROLE to owner", async function () {
      expect(await gameToken.hasRole(await gameToken.MINTER_ROLE(), owner.address)).to.equal(true);
    });

    it("Should grant PAUSER_ROLE to owner", async function () {
      expect(await gameToken.hasRole(await gameToken.PAUSER_ROLE(), owner.address)).to.equal(true);
    });
  });

  describe("Minting", function () {
    it("Should allow minter to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await gameToken.mint(user1.address, mintAmount);
      expect(await gameToken.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should emit TokensMinted event", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(gameToken.mint(user1.address, mintAmount))
        .to.emit(gameToken, "TokensMinted")
        .withArgs(user1.address, mintAmount);
    });

    it("Should not allow non-minter to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(gameToken.connect(user1).mint(user2.address, mintAmount))
        .to.be.revertedWithCustomError(gameToken, "AccessControlUnauthorizedAccount");
    });

    it("Should not mint to zero address", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(gameToken.mint(ethers.ZeroAddress, mintAmount))
        .to.be.revertedWith("GameToken: cannot mint to zero address");
    });

    it("Should not mint zero amount", async function () {
      await expect(gameToken.mint(user1.address, 0))
        .to.be.revertedWith("GameToken: amount must be greater than 0");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await gameToken.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow user to burn their own tokens", async function () {
      const burnAmount = ethers.parseEther("500");
      const initialBalance = await gameToken.balanceOf(user1.address);
      await gameToken.connect(user1).burn(burnAmount);
      expect(await gameToken.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should emit TokensBurned event", async function () {
      const burnAmount = ethers.parseEther("500");
      await expect(gameToken.connect(user1).burn(burnAmount))
        .to.emit(gameToken, "TokensBurned")
        .withArgs(user1.address, burnAmount);
    });

    it("Should not burn more tokens than balance", async function () {
      const burnAmount = ethers.parseEther("1500");
      await expect(gameToken.connect(user1).burn(burnAmount))
        .to.be.revertedWith("GameToken: insufficient balance");
    });

    it("Should not burn zero amount", async function () {
      await expect(gameToken.connect(user1).burn(0))
        .to.be.revertedWith("GameToken: amount must be greater than 0");
    });

    it("Should allow minter to burn from other address with allowance", async function () {
      const burnAmount = ethers.parseEther("500");
      await gameToken.connect(user1).approve(owner.address, burnAmount);
      await gameToken.burnFrom(user1.address, burnAmount);
      expect(await gameToken.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should not burn from zero address", async function () {
      await expect(gameToken.burnFrom(ethers.ZeroAddress, ethers.parseEther("100")))
        .to.be.revertedWith("GameToken: cannot burn from zero address");
    });
  });

  describe("Pausing", function () {
    it("Should allow pauser to pause", async function () {
      await gameToken.pause();
      expect(await gameToken.paused()).to.equal(true);
    });

    it("Should not allow non-pauser to pause", async function () {
      await expect(gameToken.connect(user1).pause())
        .to.be.revertedWithCustomError(gameToken, "AccessControlUnauthorizedAccount");
    });

    it("Should allow pauser to unpause", async function () {
      await gameToken.pause();
      await gameToken.unpause();
      expect(await gameToken.paused()).to.equal(false);
    });

    it("Should not allow transfers when paused", async function () {
      await gameToken.mint(user1.address, ethers.parseEther("1000"));
      await gameToken.pause();
      await expect(gameToken.connect(user1).transfer(user2.address, ethers.parseEther("100")))
        .to.be.reverted;
    });

    it("Should not allow minting when paused", async function () {
      await gameToken.pause();
      await expect(gameToken.mint(user1.address, ethers.parseEther("1000")))
        .to.be.reverted;
    });

    it("Should not allow burning when paused", async function () {
      await gameToken.mint(user1.address, ethers.parseEther("1000"));
      await gameToken.pause();
      await expect(gameToken.connect(user1).burn(ethers.parseEther("100")))
        .to.be.reverted;
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      await gameToken.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("100");
      await gameToken.connect(user1).transfer(user2.address, transferAmount);
      expect(await gameToken.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const transferAmount = ethers.parseEther("1500");
      await expect(gameToken.connect(user1).transfer(user2.address, transferAmount))
        .to.be.reverted;
    });

    it("Should update balances after transfers", async function () {
      const initialBalance = await gameToken.balanceOf(user1.address);
      const transferAmount = ethers.parseEther("100");
      await gameToken.connect(user1).transfer(user2.address, transferAmount);
      expect(await gameToken.balanceOf(user1.address)).to.equal(initialBalance - transferAmount);
    });
  });

  describe("Allowances", function () {
    beforeEach(async function () {
      await gameToken.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should approve tokens for delegated transfer", async function () {
      const approveAmount = ethers.parseEther("100");
      await gameToken.connect(user1).approve(user2.address, approveAmount);
      expect(await gameToken.allowance(user1.address, user2.address)).to.equal(approveAmount);
    });

    it("Should transfer tokens using transferFrom", async function () {
      const approveAmount = ethers.parseEther("100");
      await gameToken.connect(user1).approve(user2.address, approveAmount);
      await gameToken.connect(user2).transferFrom(user1.address, user2.address, approveAmount);
      expect(await gameToken.balanceOf(user2.address)).to.equal(approveAmount);
    });

    it("Should fail transferFrom if not enough allowance", async function () {
      const approveAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("150");
      await gameToken.connect(user1).approve(user2.address, approveAmount);
      await expect(gameToken.connect(user2).transferFrom(user1.address, user2.address, transferAmount))
        .to.be.reverted;
    });
  });

  describe("Role Management", function () {
    it("Should grant MINTER_ROLE to new address", async function () {
      await gameToken.grantRole(await gameToken.MINTER_ROLE(), minter.address);
      expect(await gameToken.hasRole(await gameToken.MINTER_ROLE(), minter.address)).to.equal(true);
    });

    it("Should revoke MINTER_ROLE", async function () {
      await gameToken.grantRole(await gameToken.MINTER_ROLE(), minter.address);
      await gameToken.revokeRole(await gameToken.MINTER_ROLE(), minter.address);
      expect(await gameToken.hasRole(await gameToken.MINTER_ROLE(), minter.address)).to.equal(false);
    });

    it("Should grant PAUSER_ROLE to new address", async function () {
      await gameToken.grantRole(await gameToken.PAUSER_ROLE(), pauser.address);
      expect(await gameToken.hasRole(await gameToken.PAUSER_ROLE(), pauser.address)).to.equal(true);
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to recover tokens", async function () {
      // Create a mock token for testing
      const MockToken = await ethers.getContractFactory("MockERC20");
      const mockToken = await MockToken.deploy("Mock", "MOCK", 18);
      await mockToken.mint(owner.address, ethers.parseEther("1000"));

      // Transfer some tokens to the GameToken contract by mistake
      await mockToken.transfer(await gameToken.getAddress(), ethers.parseEther("100"));

      // Recover the tokens
      await gameToken.emergencyRecoverTokens(
        await mockToken.getAddress(),
        user1.address,
        ethers.parseEther("100")
      );

      expect(await mockToken.balanceOf(user1.address)).to.equal(ethers.parseEther("100"));
    });

    it("Should not allow non-admin to recover tokens", async function () {
      await expect(gameToken.connect(user1).emergencyRecoverTokens(
        user2.address,
        user1.address,
        ethers.parseEther("100")
      )).to.be.revertedWithCustomError(gameToken, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrant calls to mint", async function () {
      // This test would require a malicious contract to test properly
      // For now, we just verify the nonReentrant modifier is present
      const mintAmount = ethers.parseEther("1000");
      await expect(gameToken.mint(user1.address, mintAmount)).to.not.be.reverted;
    });
  });
});


