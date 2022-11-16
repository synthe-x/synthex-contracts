// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WONE is ERC20 {
    event Claim(address indexed user, uint amount);

    constructor() ERC20("Wrapped ONE", "WONE") {}

    fallback() external { 
        deposit();
    }
    
    function deposit() public {
        _mint(msg.sender, 1000000*10**decimals());
        emit Claim(msg.sender, 1000000*10**decimals());
    }
}