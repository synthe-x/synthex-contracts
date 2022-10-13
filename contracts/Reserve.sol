// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./interfaces/IReserve.sol";
import "./interfaces/ISystem.sol";
import "./interfaces/IDebtManager.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/ISynthERC20.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol";

contract Reserve {
    using SafeMath for uint;
    ISystem system;

    constructor(ISystem _system){
        system = _system;
    }

    function exchange(address user, address src, uint srcAmount, address dst) external {
        require(msg.sender == address(system), "BaseReserve: Only system can call exchange");

        IDebtManager(system.dManager())._decreaseDebt(user, src, srcAmount);
        uint dstAmt = srcAmount.mul(ISynthERC20(src).get_price()).div(ISynthERC20(dst).get_price());
        IDebtManager(system.dManager())._increaseDebt(user, dst, dstAmt);
    }

    function increaseCollateral(address user, address asset, uint amount) external {
        require(msg.sender == address(system), "BaseReserve: Only system can call exchange");
        ICollateralManager(system.cManager())._increaseCollateral(
            user,
            asset,
            amount
        );
    }

    function decreaseCollateral(address user, address asset, uint amount) external {
        require(msg.sender == address(system), "BaseReserve: Only system can call exchange");
        ICollateralManager(system.cManager())._decreaseCollateral(
            user,
            asset,
            amount
        );
        require(system.collateralRatio(user) > system.safeCRatio(), "Reserve: cRatio is below safeCRatio");   
        transferOutInternal(user, asset, amount);
    }

    function transferOut(
        address user,
        address asset,
        uint amount
    ) external {
        require(
            msg.sender == system.liquidator(),
            "Only liquidator can transfer out externally"
        );

        transferOutInternal(user, asset, amount);
    }

    function transferOutInternal(
        address user,
        address asset,
        uint amount
    ) internal {
        IERC20(asset).transfer(user, amount);
    }

    function increaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == address(system), "BaseReserve: Only system can call increase debt");
        IDebtManager(system.dManager())._increaseDebt(
            user,
            asset,
            amount
        );
    }

    function decreaseDebt(address user, address token, uint amount) external {
        require(msg.sender == address(system), "BaseReserve: Only system can call decrease debt");
        IDebtManager(system.dManager())._decreaseDebt(
            user,
            token,
            amount
        );
    }
}
