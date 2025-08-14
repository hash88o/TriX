// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GameToken.sol";

/**
 * @title PlayGame
 * @dev Contract for managing PvP match staking and payouts
 * @dev Implements escrow functionality with re-entrancy protection
 * @dev Winner receives exactly 2x stake; no platform fees
 */
contract PlayGame is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    GameToken public immutable gameToken;

    uint256 public constant TIMEOUT_DURATION = 24 hours;

    struct Match {
        bytes32 matchId;
        address p1;
        address p2;
        uint256 stake;
        MatchStatus status;
        uint256 startTime;
        bool p1Staked;
        bool p2Staked;
    }

    enum MatchStatus {
        CREATED, // Match created, waiting for stakes
        STAKED, // Both players staked, match active
        SETTLED, // Match completed with winner
        REFUNDED // Match refunded due to timeout
    }

    // Match tracking
    mapping(bytes32 => Match) public matches;

    // Statistics
    uint256 public totalMatches;
    uint256 public totalStaked;
    uint256 public totalPayouts;

    // Events
    event MatchCreated(
        bytes32 indexed matchId,
        address indexed p1,
        address indexed p2,
        uint256 stake
    );
    event Staked(
        bytes32 indexed matchId,
        address indexed player,
        uint256 amount
    );
    event Settled(
        bytes32 indexed matchId,
        address indexed winner,
        uint256 payout
    );
    event Refunded(
        bytes32 indexed matchId,
        address indexed player,
        uint256 amount
    );

    /**
     * @dev Constructor sets up the contract with GameToken address
     * @param _gameToken Address of the GameToken contract
     */
    constructor(address _gameToken) {
        require(
            _gameToken != address(0),
            "PlayGame: invalid game token address"
        );

        gameToken = GameToken(_gameToken);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @dev Create a new match (owner/manager only)
     * @param matchId Unique identifier for the match
     * @param p1 Address of player 1
     * @param p2 Address of player 2
     * @param stake Amount of GT tokens each player must stake
     */
    function createMatch(
        bytes32 matchId,
        address p1,
        address p2,
        uint256 stake
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        require(matchId != bytes32(0), "PlayGame: invalid match ID");
        require(p1 != address(0), "PlayGame: invalid player 1 address");
        require(p2 != address(0), "PlayGame: invalid player 2 address");
        require(p1 != p2, "PlayGame: players must be different");
        require(stake > 0, "PlayGame: stake must be greater than 0");
        require(
            matches[matchId].matchId == bytes32(0),
            "PlayGame: match already exists"
        );

        matches[matchId] = Match({
            matchId: matchId,
            p1: p1,
            p2: p2,
            stake: stake,
            status: MatchStatus.CREATED,
            startTime: 0,
            p1Staked: false,
            p2Staked: false
        });

        totalMatches++;

        emit MatchCreated(matchId, p1, p2, stake);
    }

    /**
     * @dev Stake GT tokens for a match
     * @param matchId ID of the match to stake for
     */
    function stake(bytes32 matchId) external whenNotPaused nonReentrant {
        Match storage matchData = matches[matchId];
        require(
            matchData.matchId != bytes32(0),
            "PlayGame: match does not exist"
        );
        require(
            matchData.status == MatchStatus.CREATED,
            "PlayGame: match not available for staking"
        );
        require(
            msg.sender == matchData.p1 || msg.sender == matchData.p2,
            "PlayGame: not a participant"
        );

        uint256 stakeAmount = matchData.stake;
        require(
            gameToken.balanceOf(msg.sender) >= stakeAmount,
            "PlayGame: insufficient GT balance"
        );
        require(
            gameToken.allowance(msg.sender, address(this)) >= stakeAmount,
            "PlayGame: insufficient GT allowance"
        );

        // Check if player already staked
        if (msg.sender == matchData.p1) {
            require(!matchData.p1Staked, "PlayGame: player 1 already staked");
            matchData.p1Staked = true;
        } else {
            require(!matchData.p2Staked, "PlayGame: player 2 already staked");
            matchData.p2Staked = true;
        }

        // Pull GT tokens via transferFrom
        require(
            gameToken.transferFrom(msg.sender, address(this), stakeAmount),
            "PlayGame: GT transfer failed"
        );

        totalStaked += stakeAmount;

        emit Staked(matchId, msg.sender, stakeAmount);

        // If both players have staked, activate the match
        if (matchData.p1Staked && matchData.p2Staked) {
            matchData.status = MatchStatus.STAKED;
            matchData.startTime = block.timestamp;
        }
    }

    /**
     * @dev Commit match result (backend/operator only)
     * @param matchId ID of the match
     * @param winner Address of the winning player
     */
    function commitResult(
        bytes32 matchId,
        address winner
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        Match storage matchData = matches[matchId];
        require(
            matchData.matchId != bytes32(0),
            "PlayGame: match does not exist"
        );
        require(
            matchData.status == MatchStatus.STAKED,
            "PlayGame: match not staked"
        );
        require(
            winner == matchData.p1 || winner == matchData.p2,
            "PlayGame: invalid winner"
        );

        uint256 totalPayout = matchData.stake * 2;

        // Update match status
        matchData.status = MatchStatus.SETTLED;

        // Transfer 2x stake GT to winner
        require(
            gameToken.transfer(winner, totalPayout),
            "PlayGame: winner payout failed"
        );

        totalPayouts += totalPayout;

        emit Settled(matchId, winner, totalPayout);
    }

    /**
     * @dev Refund stakes after timeout if match not settled
     * @param matchId ID of the match to refund
     */
    function refund(bytes32 matchId) external whenNotPaused nonReentrant {
        Match storage matchData = matches[matchId];
        require(
            matchData.matchId != bytes32(0),
            "PlayGame: match does not exist"
        );
        require(
            matchData.status == MatchStatus.STAKED,
            "PlayGame: match not eligible for refund"
        );
        require(
            block.timestamp >= matchData.startTime + TIMEOUT_DURATION,
            "PlayGame: refund timeout not reached"
        );

        uint256 stakeAmount = matchData.stake;

        // Update match status
        matchData.status = MatchStatus.REFUNDED;

        // Refund stakes to both players
        if (matchData.p1Staked) {
            require(
                gameToken.transfer(matchData.p1, stakeAmount),
                "PlayGame: p1 refund failed"
            );
            totalStaked -= stakeAmount;
            emit Refunded(matchId, matchData.p1, stakeAmount);
        }

        if (matchData.p2Staked) {
            require(
                gameToken.transfer(matchData.p2, stakeAmount),
                "PlayGame: p2 refund failed"
            );
            totalStaked -= stakeAmount;
            emit Refunded(matchId, matchData.p2, stakeAmount);
        }
    }

    /**
     * @dev Get match details
     * @param matchId ID of the match
     * @return matchData Complete match data
     */
    function getMatch(
        bytes32 matchId
    ) external view returns (Match memory matchData) {
        return matches[matchId];
    }

    /**
     * @dev Check if a match can be refunded
     * @param matchId ID of the match
     * @return canRefund True if match can be refunded
     */
    function canRefund(bytes32 matchId) external view returns (bool canRefund) {
        Match memory matchData = matches[matchId];
        return
            matchData.status == MatchStatus.STAKED &&
            block.timestamp >= matchData.startTime + TIMEOUT_DURATION;
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
    function emergencyWithdrawGT(
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "PlayGame: cannot withdraw to zero address");
        require(amount > 0, "PlayGame: amount must be greater than 0");
        require(
            amount <= gameToken.balanceOf(address(this)),
            "PlayGame: insufficient balance"
        );

        gameToken.transfer(to, amount);
    }

    /**
     * @dev Refund pre-staked amount (for matchmaking timeouts)
     * @param player Address of the player to refund
     * @param amount Amount to refund
     */
    function refundPreStake(
        address player,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        require(player != address(0), "PlayGame: invalid player address");
        require(amount > 0, "PlayGame: amount must be greater than 0");
        require(
            amount <= gameToken.balanceOf(address(this)),
            "PlayGame: insufficient balance"
        );

        require(
            gameToken.transfer(player, amount),
            "PlayGame: pre-stake refund failed"
        );

        totalStaked -= amount;
        emit Refunded(bytes32(0), player, amount); // Use zero bytes32 for pre-stake refunds
    }

    /**
     * @dev Get contract statistics
     * @return _totalMatches Total number of matches created
     * @return _totalStaked Total amount staked
     * @return _totalPayouts Total amount paid out
     */
    function getStats()
        external
        view
        returns (
            uint256 _totalMatches,
            uint256 _totalStaked,
            uint256 _totalPayouts
        )
    {
        return (totalMatches, totalStaked, totalPayouts);
    }

    /**
     * @dev Check if contract is paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
}
