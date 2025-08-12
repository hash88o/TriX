// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDT
 * @dev Mock USDT token for testing purposes
 * @dev Mimics USDT with 6 decimals and minting capabilities
 */
contract MockUSDT is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    /**
     * @dev Constructor that gives the deployer an initial supply
     * @param initialSupply Initial supply to mint to deployer
     */
    constructor(
        uint256 initialSupply
    ) ERC20("Mock USDT", "USDT") Ownable(msg.sender) {
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    /**
     * @dev Returns the number of decimals used to get its user representation
     */
    function decimals() public view virtual override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mint new tokens to specified address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "MockUSDT: cannot mint to zero address");
        require(amount > 0, "MockUSDT: amount must be greater than 0");

        _mint(to, amount);
    }

    /**
     * @dev Faucet function - anyone can get 1000 USDT once per day
     */
    mapping(address => uint256) private _lastFaucetClaim;
    uint256 private constant FAUCET_AMOUNT = 1000 * 10 ** DECIMALS; // 1000 USDT
    uint256 private constant FAUCET_COOLDOWN = 24 hours;

    function faucet() external {
        require(
            block.timestamp >= _lastFaucetClaim[msg.sender] + FAUCET_COOLDOWN,
            "MockUSDT: faucet cooldown not met"
        );

        _lastFaucetClaim[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /**
     * @dev Get time until next faucet claim
     * @param account Address to check
     * @return Time in seconds until next claim (0 if can claim now)
     */
    function faucetCooldown(address account) external view returns (uint256) {
        uint256 nextClaim = _lastFaucetClaim[account] + FAUCET_COOLDOWN;
        if (block.timestamp >= nextClaim) {
            return 0;
        }
        return nextClaim - block.timestamp;
    }

    /**
     * @dev Burn tokens from caller's account
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        require(amount > 0, "MockUSDT: amount must be greater than 0");
        require(
            balanceOf(msg.sender) >= amount,
            "MockUSDT: insufficient balance"
        );

        _burn(msg.sender, amount);
    }
}
