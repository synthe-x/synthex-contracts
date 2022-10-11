// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract WTRX is ERC20 {
    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    constructor() ERC20("Wrapped TRX", "WTRX") {}

    fallback() external { 
        deposit();
    }
    
    function deposit() public payable {
        _mint(msg.sender, 100000000*10**18);
        emit Deposit(msg.sender, 100000000*10**18);
    }
    
    function withdraw(uint wad) public {
        require(balanceOf(msg.sender) >= wad);
        _burn(msg.sender, wad);
        payable(msg.sender).transfer(wad);
        emit Withdrawal(msg.sender, wad);
    }
}