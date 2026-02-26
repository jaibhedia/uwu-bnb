// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @notice Testnet-only ERC20 with 6 decimals (same as real USDC) for opBNB/BSC testnet.
 *          Do not use on mainnet.
 */
contract MockUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor() ERC20("Mock USDC", "USDC") Ownable(msg.sender) {
        // Mint 1_000_000 USDC (6 decimals) to deployer
        _mint(msg.sender, 1_000_000 * (10 ** _DECIMALS));
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Mint test tokens (testnet only)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
