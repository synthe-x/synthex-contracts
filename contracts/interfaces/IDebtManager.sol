// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface IDebtManager {
    function create(string memory name, string memory symbol, address oracle, address interestRateModel) external returns(address);

    function dAssetsCount() external view returns (uint);
    function dAssets(uint) external view returns (address);
    function assetToDAsset(address) external view returns (address);
    function debt(address, address) external view returns (uint);
    
    function _increaseDebt(address user, address asset, uint amount) external;
    function _decreaseDebt(address user, address asset, uint amount) external;

    function totalDebt(address account) external view returns(uint);
}