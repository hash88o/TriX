// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./GameToken.sol";
import "./interfaces/IUSDT.sol";

/**
 * @title TokenStore
 * @dev Contract for purchasing GameTokens with USDT
 * @dev Implements 1:1 USDT to GT conversion rate
 * @dev Only authorized contracts can mint GT tokens
 */
contract TokenStore is AccessControl, Pausable, ReentrancyGuard {
    using Address for address payable;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    GameToken public immutable gameToken;
    IUSDT public immutable usdtToken;
    uint256 public immutable gtPerUsdt;

    uint256 public constant USDT_DECIMALS = 6;
    uint256 public constant GT_DECIMALS = 18;
    uint256 public constant DECIMAL_ADJUSTMENT =
        10 ** (GT_DECIMALS - USDT_DECIMALS);

    uint256 public totalPurchases;
    uint256 public totalUSDTReceived;

    event Purchase(address indexed buyer, uint256 usdtAmount, uint256 gtOut);
    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    /**
     * @dev Constructor sets up the contract with GameToken and USDT addresses
     * @param _usdt Address of the USDT token contract
     * @param _gameToken Address of the GameToken contract
     * @param _gtPerUsdt GT tokens per USDT (e.g., 1e18 for 1:1 conversion)
     */
    constructor(address _usdt, address _gameToken, uint256 _gtPerUsdt) {
        require(_usdt != address(0), "TokenStore: invalid USDT address");
        require(
            _gameToken != address(0),
            "TokenStore: invalid game token address"
        );
        require(_gtPerUsdt > 0, "TokenStore: gtPerUsdt must be greater than 0");

        usdtToken = IUSDT(_usdt);
        gameToken = GameToken(_gameToken);
        gtPerUsdt = _gtPerUsdt;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @dev Buy GT tokens with USDT (1:1 conversion rate)
     * @param usdtAmount Amount of USDT to spend (6 decimals)
     */
    function buy(uint256 usdtAmount) external whenNotPaused nonReentrant {
        require(usdtAmount > 0, "TokenStore: amount must be greater than 0");
        require(
            usdtAmount <= usdtToken.balanceOf(msg.sender),
            "TokenStore: insufficient USDT balance"
        );
        require(
            usdtAmount <= usdtToken.allowance(msg.sender, address(this)),
            "TokenStore: insufficient USDT allowance"
        );

        // Pull USDT (6 decimals) with transferFrom
        require(
            usdtToken.transferFrom(msg.sender, address(this), usdtAmount),
            "TokenStore: USDT transfer failed"
        );

        // Calculate GT amount: usdtAmount * gtPerUsdt / 1e6
        uint256 gtOut = (usdtAmount * gtPerUsdt) / (10 ** USDT_DECIMALS);

        // Mint GT tokens to buyer
        gameToken.mint(msg.sender, gtOut);

        // Update statistics
        totalPurchases++;
        totalUSDTReceived += usdtAmount;

        emit Purchase(msg.sender, usdtAmount, gtOut);
    }

    /**
     * @dev Get the GT amount for a given USDT amount
     * @param usdtAmount Amount of USDT
     * @return gtAmount Equivalent GT amount
     */
    function getGTAmount(
        uint256 usdtAmount
    ) external view returns (uint256 gtAmount) {
        return (usdtAmount * gtPerUsdt) / (10 ** USDT_DECIMALS);
    }

    /**
     * @dev Get the USDT amount for a given GT amount
     * @param gtAmount Amount of GT tokens
     * @return usdtAmount Equivalent USDT amount
     */
    function getUSDTAmount(
        uint256 gtAmount
    ) external view returns (uint256 usdtAmount) {
        return (gtAmount * (10 ** USDT_DECIMALS)) / gtPerUsdt;
    }

    /**
     * @dev Withdraw USDT from contract (owner only)
     * @param to Address to send USDT to
     * @param amount Amount of USDT to withdraw
     */
    function withdrawUSDT(
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            to != address(0),
            "TokenStore: cannot withdraw to zero address"
        );
        require(amount > 0, "TokenStore: amount must be greater than 0");
        require(
            amount <= usdtToken.balanceOf(address(this)),
            "TokenStore: insufficient USDT balance"
        );

        require(
            usdtToken.transfer(to, amount),
            "TokenStore: USDT transfer failed"
        );
    }

    /**
     * @dev Pause all purchases. Only callable by accounts with PAUSER_ROLE
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause all purchases. Only callable by accounts with PAUSER_ROLE
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Emergency function to withdraw tokens stuck in contract
     * @param tokenAddress Address of the token to withdraw
     * @param to Address to send tokens to
     * @param amount Amount of tokens to withdraw
     */
    function emergencyWithdraw(
        address tokenAddress,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            to != address(0),
            "TokenStore: cannot withdraw to zero address"
        );
        require(amount > 0, "TokenStore: amount must be greater than 0");

        IERC20(tokenAddress).transfer(to, amount);
        emit EmergencyWithdraw(tokenAddress, to, amount);
    }

    /**
     * @dev Emergency function to withdraw ETH stuck in contract
     * @param to Address to send ETH to
     * @param amount Amount of ETH to withdraw
     */
    function emergencyWithdrawETH(
        address payable to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            to != address(0),
            "TokenStore: cannot withdraw to zero address"
        );
        require(amount > 0, "TokenStore: amount must be greater than 0");
        require(
            amount <= address(this).balance,
            "TokenStore: insufficient ETH balance"
        );

        to.sendValue(amount);
        emit EmergencyWithdraw(address(0), to, amount);
    }

    /**
     * @dev Get contract statistics
     * @return _totalPurchases Total number of purchases
     * @return _totalUSDTReceived Total USDT received
     * @return _gtPerUsdt Current conversion rate
     */
    function getStats()
        external
        view
        returns (
            uint256 _totalPurchases,
            uint256 _totalUSDTReceived,
            uint256 _gtPerUsdt
        )
    {
        return (totalPurchases, totalUSDTReceived, gtPerUsdt);
    }

    /**
     * @dev Check if contract is paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }

    /**
     * @dev Receive function to accept ETH
     */
    receive() external payable {
        // Accept ETH for potential emergency withdrawals
    }
}
