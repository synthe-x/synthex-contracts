// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WETH is ERC20 {
    event Claim(address indexed user, uint amount);

    constructor() ERC20("Wrapped ETH", "ETH") {}

    fallback() external { 
        deposit();
    }
    
    function deposit() public {
        _mint(msg.sender, 10*10**decimals());
        emit Claim(msg.sender, 10*10**decimals());
    }
}