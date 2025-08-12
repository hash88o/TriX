// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GameToken
 * @dev ERC-20 compliant token for TriX gaming system
 * @dev Only TokenStore contract can mint tokens
 * @dev Includes emergency pause functionality
 */
contract GameToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint8 private constant DECIMALS = 18;
    
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    
    /**
     * @dev Constructor sets up initial roles and assigns tokens to deployer
     * @param initialSupply Initial token supply to mint to deployer
     * @param name Token name
     * @param symbol Token symbol
     */
    constructor(
        uint256 initialSupply,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        
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
     * @dev Mints new tokens. Only callable by accounts with MINTER_ROLE
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(to != address(0), "GameToken: cannot mint to zero address");
        require(amount > 0, "GameToken: amount must be greater than 0");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Burns tokens from caller's account
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) 
        external 
        whenNotPaused 
        nonReentrant 
    {
        require(amount > 0, "GameToken: amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "GameToken: insufficient balance");
        
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev Burns tokens from specified account. Only callable by accounts with MINTER_ROLE
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(from != address(0), "GameToken: cannot burn from zero address");
        require(amount > 0, "GameToken: amount must be greater than 0");
        require(balanceOf(from) >= amount, "GameToken: insufficient balance");
        
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "GameToken: burn amount exceeds allowance");
        
        _spendAllowance(from, msg.sender, amount);
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Pauses all token transfers. Only callable by accounts with PAUSER_ROLE
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpauses all token transfers. Only callable by accounts with PAUSER_ROLE
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Override transfer function to include pause check
     */
    function transfer(address to, uint256 amount) 
        public 
        virtual 
        override 
        whenNotPaused 
        nonReentrant 
        returns (bool) 
    {
        return super.transfer(to, amount);
    }
    
    /**
     * @dev Override transferFrom function to include pause check
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        virtual 
        override 
        whenNotPaused 
        nonReentrant 
        returns (bool) 
    {
        return super.transferFrom(from, to, amount);
    }
    
    /**
     * @dev Override approve function to include pause check
     */
    function approve(address spender, uint256 amount) 
        public 
        virtual 
        override 
        whenNotPaused 
        nonReentrant 
        returns (bool) 
    {
        return super.approve(spender, amount);
    }
    

    
    /**
     * @dev Emergency function to recover tokens sent to contract by mistake
     * @param tokenAddress Address of the token to recover
     * @param to Address to send recovered tokens to
     * @param amount Amount of tokens to recover
     */
    function emergencyRecoverTokens(
        address tokenAddress,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(to != address(0), "GameToken: cannot recover to zero address");
        require(amount > 0, "GameToken: amount must be greater than 0");
        
        IERC20(tokenAddress).transfer(to, amount);
    }
}
