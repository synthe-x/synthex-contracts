// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "./interfaces/ISynthERC20.sol";
import "./interfaces/IReserve.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/IDebtManager.sol";
import "./interfaces/ISystem.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Exchanger {
    using SafeMath for uint;
    
    ISystem system;

    event Exchange(address account, address fromAsset, uint fromAmount, address toAsset);

    constructor(ISystem _system){
        system = _system;
    }

    function exchange(address user, address src, uint srcAmount, address dst) external {
        require(msg.sender == system.reserve(), "Exchanger: Only reserve can call exchange");
        
        (uint price, uint decimals) = ISynthERC20(dst).get_price();
        (uint srcPrice, uint srcDecimals) = ISynthERC20(src).get_price();

        IDebtManager(system.dManager())._decreaseDebt(user, src, srcAmount);
        uint dstAmt = srcAmount.mul(srcPrice).div(price).mul(decimals).div(srcDecimals);
        IDebtManager(system.dManager())._increaseDebt(user, dst, dstAmt);

        emit Exchange(user, src, srcAmount, dst);
    }
}