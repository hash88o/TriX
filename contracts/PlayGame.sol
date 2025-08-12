// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./GameToken.sol";

/**
 * @title PlayGame
 * @dev Contract for managing PvP match staking and payouts
 * @dev Accepts equal GT stakes from two players
 * @dev Implements escrow functionality with re-entrancy protection
 */
contract PlayGame is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant API_GATEWAY_ROLE = keccak256("API_GATEWAY_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    GameToken public immutable gameToken;
    
    uint256 private _nextMatchId = 1;
    
    struct Match {
        uint256 matchId;
        address player1;
        address player2;
        uint256 stakeAmount;
        uint256 totalStake;
        MatchStatus status;
        uint256 createdAt;
        uint256 completedAt;
        address winner;
    }
    
    enum MatchStatus {
        Pending,    // Waiting for second player
        Active,     // Both players staked, match in progress
        Completed,  // Match finished, winner determined
        Cancelled   // Match cancelled (refunded)
    }
    
    // Match tracking
    mapping(uint256 => Match) public matches;
    mapping(address => uint256[]) public playerMatches;
    
    // Statistics
    uint256 public totalMatches;
    uint256 public totalStaked;
    uint256 public totalPayouts;
    uint256 public platformFeePercentage = 500; // 5% (in basis points)
    uint256 public constant BASIS_POINTS = 10000;
    
    // Events
    event MatchCreated(uint256 indexed matchId, address indexed player1, uint256 stakeAmount);
    event PlayerJoined(uint256 indexed matchId, address indexed player2);
    event MatchCompleted(uint256 indexed matchId, address indexed winner, uint256 payout);
    event MatchCancelled(uint256 indexed matchId, address indexed player1, address indexed player2);
    event StakeRefunded(uint256 indexed matchId, address indexed player, uint256 amount);
    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);
    
    /**
     * @dev Constructor sets up the contract with GameToken address
     * @param _gameToken Address of the GameToken contract
     */
    constructor(address _gameToken) {
        require(_gameToken != address(0), "PlayGame: invalid game token address");
        
        gameToken = GameToken(_gameToken);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(API_GATEWAY_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    /**
     * @dev Create a new match and stake GT tokens
     * @param stakeAmount Amount of GT tokens to stake
     * @return matchId The ID of the created match
     */
    function createMatch(uint256 stakeAmount) 
        external 
        whenNotPaused 
        nonReentrant 
        returns (uint256 matchId) 
    {
        require(stakeAmount > 0, "PlayGame: stake amount must be greater than 0");
        require(gameToken.balanceOf(msg.sender) >= stakeAmount, "PlayGame: insufficient GT balance");
        require(gameToken.allowance(msg.sender, address(this)) >= stakeAmount, "PlayGame: insufficient GT allowance");
        
        matchId = _nextMatchId;
        _nextMatchId++;
        
        // Transfer GT tokens from player to contract
        require(gameToken.transferFrom(msg.sender, address(this), stakeAmount), "PlayGame: GT transfer failed");
        
        // Create match
        matches[matchId] = Match({
            matchId: matchId,
            player1: msg.sender,
            player2: address(0),
            stakeAmount: stakeAmount,
            totalStake: stakeAmount,
            status: MatchStatus.Pending,
            createdAt: block.timestamp,
            completedAt: 0,
            winner: address(0)
        });
        
        playerMatches[msg.sender].push(matchId);
        totalMatches++;
        totalStaked += stakeAmount;
        
        emit MatchCreated(matchId, msg.sender, stakeAmount);
        return matchId;
    }
    
    /**
     * @dev Join an existing match by staking equal amount
     * @param matchId ID of the match to join
     */
    function joinMatch(uint256 matchId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Match storage matchData = matches[matchId];
        require(matchData.status == MatchStatus.Pending, "PlayGame: match not available");
        require(matchData.player1 != msg.sender, "PlayGame: cannot join own match");
        require(matchData.player1 != address(0), "PlayGame: match does not exist");
        
        uint256 stakeAmount = matchData.stakeAmount;
        require(gameToken.balanceOf(msg.sender) >= stakeAmount, "PlayGame: insufficient GT balance");
        require(gameToken.allowance(msg.sender, address(this)) >= stakeAmount, "PlayGame: insufficient GT allowance");
        
        // Transfer GT tokens from player to contract
        require(gameToken.transferFrom(msg.sender, address(this), stakeAmount), "PlayGame: GT transfer failed");
        
        // Update match
        matchData.player2 = msg.sender;
        matchData.totalStake = stakeAmount * 2;
        matchData.status = MatchStatus.Active;
        
        playerMatches[msg.sender].push(matchId);
        totalStaked += stakeAmount;
        
        emit PlayerJoined(matchId, msg.sender);
    }
    
    /**
     * @dev Complete a match and pay out to winner (only callable by API Gateway)
     * @param matchId ID of the match to complete
     * @param winner Address of the winning player
     */
    function completeMatch(uint256 matchId, address winner) 
        external 
        onlyRole(API_GATEWAY_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        Match storage matchData = matches[matchId];
        require(matchData.status == MatchStatus.Active, "PlayGame: match not active");
        require(winner == matchData.player1 || winner == matchData.player2, "PlayGame: invalid winner");
        require(winner != address(0), "PlayGame: winner cannot be zero address");
        
        uint256 totalStake = matchData.totalStake;
        uint256 platformFee = (totalStake * platformFeePercentage) / BASIS_POINTS;
        uint256 winnerPayout = totalStake - platformFee;
        
        // Update match status
        matchData.status = MatchStatus.Completed;
        matchData.completedAt = block.timestamp;
        matchData.winner = winner;
        
        // Transfer winnings to winner
        require(gameToken.transfer(winner, winnerPayout), "PlayGame: winner payout failed");
        
        totalPayouts += winnerPayout;
        
        emit MatchCompleted(matchId, winner, winnerPayout);
    }
    
    /**
     * @dev Cancel a pending match and refund stake (only callable by player1 or admin)
     * @param matchId ID of the match to cancel
     */
    function cancelMatch(uint256 matchId) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        Match storage matchData = matches[matchId];
        require(matchData.status == MatchStatus.Pending, "PlayGame: match cannot be cancelled");
        require(
            msg.sender == matchData.player1 || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "PlayGame: not authorized to cancel"
        );
        
        uint256 stakeAmount = matchData.stakeAmount;
        
        // Update match status
        matchData.status = MatchStatus.Cancelled;
        matchData.completedAt = block.timestamp;
        
        // Refund stake to player1
        require(gameToken.transfer(matchData.player1, stakeAmount), "PlayGame: refund failed");
        
        totalStaked -= stakeAmount;
        
        emit MatchCancelled(matchId, matchData.player1, matchData.player2);
        emit StakeRefunded(matchId, matchData.player1, stakeAmount);
    }
    
    /**
     * @dev Get match details
     * @param matchId ID of the match
     * @return matchData Complete match data
     */
    function getMatch(uint256 matchId) external view returns (Match memory matchData) {
        return matches[matchId];
    }
    
    /**
     * @dev Get all matches for a player
     * @param player Address of the player
     * @return matchIds Array of match IDs
     */
    function getPlayerMatches(address player) external view returns (uint256[] memory matchIds) {
        return playerMatches[player];
    }
    
    /**
     * @dev Get pending matches available to join
     * @param limit Maximum number of matches to return
     * @return pendingMatches Array of pending match IDs
     */
    function getPendingMatches(uint256 limit) external view returns (uint256[] memory pendingMatches) {
        uint256 count = 0;
        uint256 maxMatches = _nextMatchId - 1;
        uint256[] memory temp = new uint256[](maxMatches);
        
        for (uint256 i = 1; i <= maxMatches && count < limit; i++) {
            if (matches[i].status == MatchStatus.Pending) {
                temp[count] = i;
                count++;
            }
        }
        
        pendingMatches = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            pendingMatches[i] = temp[i];
        }
        
        return pendingMatches;
    }
    
    /**
     * @dev Update platform fee percentage (only callable by admin)
     * @param newFeePercentage New fee percentage in basis points
     */
    function updatePlatformFee(uint256 newFeePercentage) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newFeePercentage <= 1000, "PlayGame: fee cannot exceed 10%");
        uint256 oldFee = platformFeePercentage;
        platformFeePercentage = newFeePercentage;
        emit PlatformFeeUpdated(oldFee, newFeePercentage);
    }
    
    /**
     * @dev Pause all game operations (only callable by accounts with PAUSER_ROLE)
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause all game operations (only callable by accounts with PAUSER_ROLE)
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Emergency function to withdraw GT tokens (only callable by admin)
     * @param to Address to send tokens to
     * @param amount Amount of tokens to withdraw
     */
    function emergencyWithdrawGT(address to, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(to != address(0), "PlayGame: cannot withdraw to zero address");
        require(amount > 0, "PlayGame: amount must be greater than 0");
        require(amount <= gameToken.balanceOf(address(this)), "PlayGame: insufficient balance");
        
        gameToken.transfer(to, amount);
        emit EmergencyWithdraw(address(gameToken), to, amount);
    }
    
    /**
     * @dev Get contract statistics
     * @return _totalMatches Total number of matches created
     * @return _totalStaked Total amount staked
     * @return _totalPayouts Total amount paid out
     * @return _platformFeePercentage Current platform fee percentage
     */
    function getStats() external view returns (
        uint256 _totalMatches,
        uint256 _totalStaked,
        uint256 _totalPayouts,
        uint256 _platformFeePercentage
    ) {
        return (totalMatches, totalStaked, totalPayouts, platformFeePercentage);
    }
    
    /**
     * @dev Check if contract is paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
    
    /**
     * @dev Get current match ID counter
     */
    function getCurrentMatchId() external view returns (uint256) {
        return _nextMatchId - 1;
    }
}
