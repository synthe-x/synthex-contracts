// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WBTT is ERC20 {
    event Claim(address indexed user, uint amount);

    constructor() ERC20("Wrapped BTT", "WBTT") {}

    fallback() external { 
        deposit();
    }
    
    function deposit() public {
        _mint(msg.sender, 100000*1e8*10**decimals());
        emit Claim(msg.sender, 100000*1e8*10**decimals());
    }
}