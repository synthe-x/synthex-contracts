// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WTRX is ERC20 {
    event Claim(address indexed user, uint amount);

    constructor() ERC20("Wrapped TRX", "WTRX") {}

    fallback() external { 
        deposit();
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
    
    function deposit() public {
        _mint(msg.sender, 100000*10**decimals());
        emit Claim(msg.sender, 100000*10**decimals());
    }
}