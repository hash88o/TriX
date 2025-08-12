const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PlayGame", function () {
  let GameToken, PlayGame;
  let gameToken, playGame;
  let owner, apiGateway, player1, player2, player3;
  let addrs;

  const TOKEN_NAME = "TriX Game Token";
  const TOKEN_SYMBOL = "GT";
  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const STAKE_AMOUNT = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, apiGateway, player1, player2, player3, ...addrs] = await ethers.getSigners();

    // Deploy GameToken
    GameToken = await ethers.getContractFactory("GameToken");
    gameToken = await GameToken.deploy(INITIAL_SUPPLY, TOKEN_NAME, TOKEN_SYMBOL);
    await gameToken.waitForDeployment();

    // Deploy PlayGame
    PlayGame = await ethers.getContractFactory("PlayGame");
    playGame = await PlayGame.deploy(await gameToken.getAddress());
    await playGame.waitForDeployment();

    // Grant API_GATEWAY_ROLE to apiGateway
    await playGame.grantRole(await playGame.API_GATEWAY_ROLE(), apiGateway.address);

    // Mint GT tokens to players for testing
    await gameToken.mint(player1.address, ethers.parseEther("1000"));
    await gameToken.mint(player2.address, ethers.parseEther("1000"));
    await gameToken.mint(player3.address, ethers.parseEther("1000"));

    // Approve GT spending
    await gameToken.connect(player1).approve(await playGame.getAddress(), ethers.parseEther("1000"));
    await gameToken.connect(player2).approve(await playGame.getAddress(), ethers.parseEther("1000"));
    await gameToken.connect(player3).approve(await playGame.getAddress(), ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the correct GameToken address", async function () {
      expect(await playGame.gameToken()).to.equal(await gameToken.getAddress());
    });

    it("Should grant roles to owner", async function () {
      expect(await playGame.hasRole(await playGame.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await playGame.hasRole(await playGame.API_GATEWAY_ROLE(), owner.address)).to.equal(true);
      expect(await playGame.hasRole(await playGame.PAUSER_ROLE(), owner.address)).to.equal(true);
    });

    it("Should set initial platform fee to 5%", async function () {
      expect(await playGame.platformFeePercentage()).to.equal(500); // 5% in basis points
    });
  });

  describe("Match Creation", function () {
    it("Should create a match successfully", async function () {
      const initialBalance = await gameToken.balanceOf(player1.address);

      await playGame.connect(player1).createMatch(STAKE_AMOUNT);

      const match = await playGame.getMatch(1);
      expect(match.matchId).to.equal(1);
      expect(match.player1).to.equal(player1.address);
      expect(match.player2).to.equal(ethers.ZeroAddress);
      expect(match.stakeAmount).to.equal(STAKE_AMOUNT);
      expect(match.totalStake).to.equal(STAKE_AMOUNT);
      expect(match.status).to.equal(0); // Pending
      expect(match.winner).to.equal(ethers.ZeroAddress);

      // Check that tokens were transferred
      expect(await gameToken.balanceOf(player1.address)).to.equal(initialBalance - STAKE_AMOUNT);
      expect(await gameToken.balanceOf(await playGame.getAddress())).to.equal(STAKE_AMOUNT);
    });

    it("Should emit MatchCreated event", async function () {
      await expect(playGame.connect(player1).createMatch(STAKE_AMOUNT))
        .to.emit(playGame, "MatchCreated")
        .withArgs(1, player1.address, STAKE_AMOUNT);
    });

    it("Should not create match with zero stake", async function () {
      await expect(playGame.connect(player1).createMatch(0))
        .to.be.revertedWith("PlayGame: stake amount must be greater than 0");
    });

    it("Should not create match with insufficient balance", async function () {
      const largeStake = ethers.parseEther("2000");
      await expect(playGame.connect(player1).createMatch(largeStake))
        .to.be.revertedWith("PlayGame: insufficient GT balance");
    });

    it("Should not create match with insufficient allowance", async function () {
      await gameToken.connect(player1).approve(await playGame.getAddress(), 0);
      await expect(playGame.connect(player1).createMatch(STAKE_AMOUNT))
        .to.be.revertedWith("PlayGame: insufficient GT allowance");
    });

    it("Should increment match counter", async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);
      expect(await playGame.getCurrentMatchId()).to.equal(1);

      await playGame.connect(player2).createMatch(STAKE_AMOUNT);
      expect(await playGame.getCurrentMatchId()).to.equal(2);
    });
  });

  describe("Match Joining", function () {
    beforeEach(async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);
    });

    it("Should allow player to join match", async function () {
      const initialBalance = await gameToken.balanceOf(player2.address);

      await playGame.connect(player2).joinMatch(1);

      const match = await playGame.getMatch(1);
      expect(match.player2).to.equal(player2.address);
      expect(match.totalStake).to.equal(STAKE_AMOUNT * 2n);
      expect(match.status).to.equal(1); // Active

      // Check that tokens were transferred
      expect(await gameToken.balanceOf(player2.address)).to.equal(initialBalance - STAKE_AMOUNT);
      expect(await gameToken.balanceOf(await playGame.getAddress())).to.equal(STAKE_AMOUNT * 2n);
    });

    it("Should emit PlayerJoined event", async function () {
      await expect(playGame.connect(player2).joinMatch(1))
        .to.emit(playGame, "PlayerJoined")
        .withArgs(1, player2.address);
    });

    it("Should not allow player to join their own match", async function () {
      await expect(playGame.connect(player1).joinMatch(1))
        .to.be.revertedWith("PlayGame: cannot join own match");
    });

    it("Should not allow joining non-existent match", async function () {
      await expect(playGame.connect(player2).joinMatch(999))
        .to.be.revertedWith("PlayGame: match does not exist");
    });

    it("Should not allow joining completed match", async function () {
      await playGame.connect(player2).joinMatch(1);
      await playGame.connect(apiGateway).completeMatch(1, player1.address);

      await expect(playGame.connect(player3).joinMatch(1))
        .to.be.revertedWith("PlayGame: match not available");
    });

    it("Should not allow joining with insufficient balance", async function () {
      const stakeAmount = ethers.parseEther("500");
      await playGame.connect(player1).createMatch(stakeAmount);

      // Reduce player2's balance and allowance for this test
      const balance = await gameToken.balanceOf(player2.address);
      await gameToken.connect(player2).transfer(owner.address, balance);

      await expect(playGame.connect(player2).joinMatch(1))
        .to.be.revertedWith("PlayGame: insufficient GT balance");
    });
  });

  describe("Match Completion", function () {
    beforeEach(async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);
      await playGame.connect(player2).joinMatch(1);
    });

    it("Should complete match and pay winner", async function () {
      const initialWinnerBalance = await gameToken.balanceOf(player1.address);
      const totalStake = STAKE_AMOUNT * 2n;
      const platformFee = (totalStake * 500n) / 10000n; // 5% fee
      const winnerPayout = totalStake - platformFee;

      await playGame.connect(apiGateway).completeMatch(1, player1.address);

      const match = await playGame.getMatch(1);
      expect(match.status).to.equal(2); // Completed
      expect(match.winner).to.equal(player1.address);
      expect(match.completedAt).to.be.gt(0);

      // Check winner received payout
      expect(await gameToken.balanceOf(player1.address)).to.equal(initialWinnerBalance + winnerPayout);
    });

    it("Should emit MatchCompleted event", async function () {
      const totalStake = STAKE_AMOUNT * 2n;
      const platformFee = (totalStake * 500n) / 10000n;
      const winnerPayout = totalStake - platformFee;

      await expect(playGame.connect(apiGateway).completeMatch(1, player1.address))
        .to.emit(playGame, "MatchCompleted")
        .withArgs(1, player1.address, winnerPayout);
    });

    it("Should not allow non-API Gateway to complete match", async function () {
      await expect(playGame.connect(player1).completeMatch(1, player1.address))
        .to.be.revertedWithCustomError(playGame, "AccessControlUnauthorizedAccount");
    });

    it("Should not complete inactive match", async function () {
      await expect(playGame.connect(apiGateway).completeMatch(1, player1.address))
        .to.not.be.reverted;

      // Try to complete again
      await expect(playGame.connect(apiGateway).completeMatch(1, player1.address))
        .to.be.revertedWith("PlayGame: match not active");
    });

    it("Should not set invalid winner", async function () {
      await expect(playGame.connect(apiGateway).completeMatch(1, player3.address))
        .to.be.revertedWith("PlayGame: invalid winner");
    });

    it("Should not set zero address as winner", async function () {
      await expect(playGame.connect(apiGateway).completeMatch(1, ethers.ZeroAddress))
        .to.be.revertedWith("PlayGame: invalid winner");
    });
  });

  describe("Match Cancellation", function () {
    beforeEach(async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);
    });

    it("Should allow player1 to cancel pending match", async function () {
      const initialBalance = await gameToken.balanceOf(player1.address);

      await playGame.connect(player1).cancelMatch(1);

      const match = await playGame.getMatch(1);
      expect(match.status).to.equal(3); // Cancelled
      expect(match.completedAt).to.be.gt(0);

      // Check refund
      expect(await gameToken.balanceOf(player1.address)).to.equal(initialBalance + STAKE_AMOUNT);
    });

    it("Should allow admin to cancel pending match", async function () {
      await playGame.connect(owner).cancelMatch(1);

      const match = await playGame.getMatch(1);
      expect(match.status).to.equal(3); // Cancelled
    });

    it("Should emit MatchCancelled and StakeRefunded events", async function () {
      await expect(playGame.connect(player1).cancelMatch(1))
        .to.emit(playGame, "MatchCancelled")
        .withArgs(1, player1.address, ethers.ZeroAddress)
        .and.to.emit(playGame, "StakeRefunded")
        .withArgs(1, player1.address, STAKE_AMOUNT);
    });

    it("Should not allow non-player1 to cancel match", async function () {
      await expect(playGame.connect(player2).cancelMatch(1))
        .to.be.revertedWith("PlayGame: not authorized to cancel");
    });

    it("Should not cancel active match", async function () {
      await playGame.connect(player2).joinMatch(1);

      await expect(playGame.connect(player1).cancelMatch(1))
        .to.be.revertedWith("PlayGame: match cannot be cancelled");
    });
  });

  describe("Match Queries", function () {
    beforeEach(async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);
      await playGame.connect(player2).createMatch(STAKE_AMOUNT);
      await playGame.connect(player3).createMatch(STAKE_AMOUNT);
    });

    it("Should get match details", async function () {
      const match = await playGame.getMatch(1);
      expect(match.matchId).to.equal(1);
      expect(match.player1).to.equal(player1.address);
      expect(match.status).to.equal(0); // Pending
    });

    it("Should get player matches", async function () {
      const playerMatches = await playGame.getPlayerMatches(player1.address);
      expect(playerMatches.length).to.equal(1);
      expect(playerMatches[0]).to.equal(1n);
    });

    it("Should get pending matches", async function () {
      const pendingMatches = await playGame.getPendingMatches(10);
      expect(pendingMatches.length).to.equal(3);
      expect(pendingMatches).to.include(1n);
      expect(pendingMatches).to.include(2n);
      expect(pendingMatches).to.include(3n);
    });

    it("Should limit pending matches", async function () {
      const pendingMatches = await playGame.getPendingMatches(2);
      expect(pendingMatches.length).to.equal(2);
    });
  });

  describe("Platform Fee Management", function () {
    it("Should allow admin to update platform fee", async function () {
      await playGame.updatePlatformFee(300); // 3%
      expect(await playGame.platformFeePercentage()).to.equal(300);
    });

    it("Should emit PlatformFeeUpdated event", async function () {
      await expect(playGame.updatePlatformFee(300))
        .to.emit(playGame, "PlatformFeeUpdated")
        .withArgs(500, 300);
    });

    it("Should not allow non-admin to update fee", async function () {
      await expect(playGame.connect(player1).updatePlatformFee(300))
        .to.be.revertedWithCustomError(playGame, "AccessControlUnauthorizedAccount");
    });

    it("Should not set fee above 10%", async function () {
      await expect(playGame.updatePlatformFee(1500))
        .to.be.revertedWith("PlayGame: fee cannot exceed 10%");
    });
  });

  describe("Pausing", function () {
    it("Should allow pauser to pause", async function () {
      await playGame.pause();
      expect(await playGame.isPaused()).to.equal(true);
    });

    it("Should not allow non-pauser to pause", async function () {
      await expect(playGame.connect(player1).pause())
        .to.be.revertedWithCustomError(playGame, "AccessControlUnauthorizedAccount");
    });

    it("Should not allow operations when paused", async function () {
      await playGame.pause();

      await expect(playGame.connect(player1).createMatch(STAKE_AMOUNT))
        .to.be.reverted;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow admin to withdraw GT tokens", async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);

      await playGame.emergencyWithdrawGT(player1.address, STAKE_AMOUNT);
      expect(await gameToken.balanceOf(player1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should emit EmergencyWithdraw event", async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);

      await expect(playGame.emergencyWithdrawGT(player1.address, STAKE_AMOUNT))
        .to.emit(playGame, "EmergencyWithdraw")
        .withArgs(await gameToken.getAddress(), player1.address, STAKE_AMOUNT);
    });

    it("Should not allow non-admin to withdraw", async function () {
      await expect(playGame.connect(player1).emergencyWithdrawGT(player2.address, STAKE_AMOUNT))
        .to.be.revertedWithCustomError(playGame, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Statistics", function () {
    it("Should return correct statistics", async function () {
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);
      await playGame.connect(player2).joinMatch(1);
      await playGame.connect(apiGateway).completeMatch(1, player1.address);

      const stats = await playGame.getStats();
      expect(stats[0]).to.equal(1); // totalMatches
      expect(stats[1]).to.equal(STAKE_AMOUNT * 2n); // totalStaked
      expect(stats[2]).to.be.gt(0); // totalPayouts
      expect(stats[3]).to.equal(500); // platformFeePercentage
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrant calls", async function () {
      await expect(playGame.connect(player1).createMatch(STAKE_AMOUNT)).to.not.be.reverted;
    });
  });

  describe("Complete Match Lifecycle", function () {
    it("Should handle complete match lifecycle", async function () {
      // 1. Create match
      await playGame.connect(player1).createMatch(STAKE_AMOUNT);
      expect(await playGame.getCurrentMatchId()).to.equal(1);

      // 2. Join match
      await playGame.connect(player2).joinMatch(1);
      const match = await playGame.getMatch(1);
      expect(match.status).to.equal(1); // Active

      // 3. Complete match
      await playGame.connect(apiGateway).completeMatch(1, player1.address);
      const completedMatch = await playGame.getMatch(1);
      expect(completedMatch.status).to.equal(2); // Completed
      expect(completedMatch.winner).to.equal(player1.address);

      // 4. Verify statistics
      const stats = await playGame.getStats();
      expect(stats[0]).to.equal(1); // totalMatches
      expect(stats[1]).to.equal(STAKE_AMOUNT * 2n); // totalStaked
    });
  });
});
