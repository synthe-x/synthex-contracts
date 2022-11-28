// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20 {
    event Claim(address indexed user, uint amount);

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    fallback() external { 
        deposit(10);
    }
    
    function deposit(uint amount) public {
        _mint(msg.sender, amount*10**decimals());
        emit Claim(msg.sender, amount*10**decimals());
    }
}