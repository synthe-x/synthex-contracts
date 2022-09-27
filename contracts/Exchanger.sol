// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./OneERC20.sol";
import "./interfaces/IReserve.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/IDebtManager.sol";
import "./interfaces/ISystem.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Exchanger {
    using SafeMath for uint;
    
    ISystem system;

    constructor(ISystem _system){
        system = _system;
    }

    function exchange(address user, address src, uint srcAmount, address dst) external {
        require(msg.sender == system.reserve(), "Only reserve can call exchange");
        OneERC20(src).burn(user, srcAmount);
        uint dstAmt = srcAmount.mul(OneERC20(src).get_price()).div(OneERC20(dst).get_price()).mul(OneERC20(dst).priceDecimals()).div(OneERC20(src).priceDecimals());
        OneERC20(dst).issue(user, dstAmt);
    }
}