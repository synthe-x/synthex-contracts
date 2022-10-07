// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

interface ISystem {

    function minCRatio() external returns(uint);
    function safeCRatio() external returns(uint);
    function tradingPoolsCount() external returns(uint);
    function tradingPools(uint) external returns(address);
    function isTradingPool(address) external returns(bool);

    function collateralRatio(address account) external view returns(uint);
    function totalCollateral(address account) external returns (uint);
    function reservePoolDebt(address account) external returns (uint);
    function tradingPoolDebt(address account) external view returns (uint);

    function deposit(address asset, uint amount) external;
    function withdraw(address asset, uint amount) external;
    function borrow(address asset, uint amount) external;
    function repay(address asset, uint amount) external;
    function exchange(uint poolIndex, address src, uint srcAmount, address dst) external;
    function liquidate(address account) external;
    function partialLiquidate(address user, address borrowedAsset, uint borrowedAmount) external;

    // enter/exit trading pool
    function enterPool(uint poolIndex, address asset, uint amount) external;
    function exitPool(uint poolIndex, address asset, uint amount) external;

    // Address resolver
    function _addrResolver() external view returns (address);

    // System status
    function isExchangePaused() external view returns (bool);
    function isIssuancePaused() external view returns (bool);

    // Addresses
    function owner() external view returns (address);
    function reserve() external view returns (address);
    function cManager() external view returns (address);    
    function dManager() external view returns (address);
    function liquidator() external view returns (address);
}