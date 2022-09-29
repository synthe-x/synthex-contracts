// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IReserve.sol";
import "./interfaces/ISystem.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./BaseReserve.sol";

contract Reserve is BaseReserve, ReentrancyGuard {

    constructor(ISystem _system){
        system = _system;
    }

    function exchange(address src, uint srcAmount, address dst) external {
        require(system.isExchangePaused() == false, "Exchange is paused");
        _exchangeInternal(src, srcAmount, dst);
    }

    function increaseCollateral(address asset, uint amount) external nonReentrant payable {
        _increaseCollateralInternal(msg.sender, asset, amount);
    }

    function decreaseCollateral(address asset, uint amount) external nonReentrant {
        _decreaseCollateralInternal(msg.sender, asset, amount);
    }

    function borrow(address asset, uint amount) external {
        require(system.isIssuancePaused() == false, "Issuance paused");
        _borrowInternal(asset, amount);
    }

    function repay(address asset, uint amount) external {
        _repayInternal(asset, amount);
    }

    function liquidate(address user) external {
        _liquidateInternal(msg.sender, user);
    }

    function partialLiquidate(address user, address borrowedAsset, uint borrowedAmount) external {
        _partialLiquidateInternal(msg.sender, user, borrowedAsset, borrowedAmount);
    }
}
