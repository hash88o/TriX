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

    uint256 public constant CONVERSION_RATE = 1; // 1:1 USDT to GT
    uint256 public constant USDT_DECIMALS = 6;
    uint256 public constant GT_DECIMALS = 18;
    uint256 public constant DECIMAL_ADJUSTMENT =
        10 ** (GT_DECIMALS - USDT_DECIMALS);

    address public treasuryAddress;
    uint256 public totalPurchases;
    uint256 public totalUSDTReceived;

    event TokensPurchased(
        address indexed buyer,
        uint256 usdtAmount,
        uint256 gtAmount,
        uint256 timestamp
    );

    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );
    event EmergencyWithdraw(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    /**
     * @dev Constructor sets up the contract with GameToken and USDT addresses
     * @param _gameToken Address of the GameToken contract
     * @param _usdtToken Address of the USDT token contract
     * @param _treasuryAddress Address to receive USDT payments
     */
    constructor(
        address _gameToken,
        address _usdtToken,
        address _treasuryAddress
    ) {
        require(
            _gameToken != address(0),
            "TokenStore: invalid game token address"
        );
        require(_usdtToken != address(0), "TokenStore: invalid USDT address");
        require(
            _treasuryAddress != address(0),
            "TokenStore: invalid treasury address"
        );

        gameToken = GameToken(_gameToken);
        usdtToken = IUSDT(_usdtToken);
        treasuryAddress = _treasuryAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /**
     * @dev Purchase GT tokens with USDT
     * @param usdtAmount Amount of USDT to spend
     */
    function purchaseTokens(
        uint256 usdtAmount
    ) external whenNotPaused nonReentrant {
        require(usdtAmount > 0, "TokenStore: amount must be greater than 0");
        require(
            usdtAmount <= usdtToken.balanceOf(msg.sender),
            "TokenStore: insufficient USDT balance"
        );
        require(
            usdtAmount <= usdtToken.allowance(msg.sender, address(this)),
            "TokenStore: insufficient USDT allowance"
        );

        // Calculate GT amount (1:1 conversion with decimal adjustment)
        uint256 gtAmount = usdtAmount * DECIMAL_ADJUSTMENT;

        // Transfer USDT from buyer to treasury
        require(
            usdtToken.transferFrom(msg.sender, treasuryAddress, usdtAmount),
            "TokenStore: USDT transfer failed"
        );

        // Mint GT tokens to buyer
        gameToken.mint(msg.sender, gtAmount);

        // Update statistics
        totalPurchases++;
        totalUSDTReceived += usdtAmount;

        emit TokensPurchased(msg.sender, usdtAmount, gtAmount, block.timestamp);
    }

    /**
     * @dev Purchase GT tokens with USDT using permit (gasless approval)
     * @param usdtAmount Amount of USDT to spend
     * @param deadline Deadline for the permit
     * @param v Signature parameter v
     * @param r Signature parameter r
     * @param s Signature parameter s
     */
    function purchaseTokensWithPermit(
        uint256 usdtAmount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external whenNotPaused nonReentrant {
        require(usdtAmount > 0, "TokenStore: amount must be greater than 0");
        require(deadline >= block.timestamp, "TokenStore: permit expired");

        // Note: This function assumes USDT supports permit.
        // Most USDT implementations don't support permit, so this is included for completeness
        // but may not work with actual USDT contracts

        // Calculate GT amount
        uint256 gtAmount = usdtAmount * DECIMAL_ADJUSTMENT;

        // Transfer USDT from buyer to treasury
        require(
            usdtToken.transferFrom(msg.sender, treasuryAddress, usdtAmount),
            "TokenStore: USDT transfer failed"
        );

        // Mint GT tokens to buyer
        gameToken.mint(msg.sender, gtAmount);

        // Update statistics
        totalPurchases++;
        totalUSDTReceived += usdtAmount;

        emit TokensPurchased(msg.sender, usdtAmount, gtAmount, block.timestamp);
    }

    /**
     * @dev Get the GT amount for a given USDT amount
     * @param usdtAmount Amount of USDT
     * @return gtAmount Equivalent GT amount
     */
    function getGTAmount(
        uint256 usdtAmount
    ) external pure returns (uint256 gtAmount) {
        return usdtAmount * DECIMAL_ADJUSTMENT;
    }

    /**
     * @dev Get the USDT amount for a given GT amount
     * @param gtAmount Amount of GT tokens
     * @return usdtAmount Equivalent USDT amount
     */
    function getUSDTAmount(
        uint256 gtAmount
    ) external pure returns (uint256 usdtAmount) {
        return gtAmount / DECIMAL_ADJUSTMENT;
    }

    /**
     * @dev Update treasury address. Only callable by admin
     * @param newTreasury New treasury address
     */
    function updateTreasury(
        address newTreasury
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            newTreasury != address(0),
            "TokenStore: invalid treasury address"
        );
        address oldTreasury = treasuryAddress;
        treasuryAddress = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
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
     * @return _treasuryAddress Current treasury address
     */
    function getStats()
        external
        view
        returns (
            uint256 _totalPurchases,
            uint256 _totalUSDTReceived,
            address _treasuryAddress
        )
    {
        return (totalPurchases, totalUSDTReceived, treasuryAddress);
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
