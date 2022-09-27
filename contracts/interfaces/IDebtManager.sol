// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IDebtManager {
    function dAssetsCount() external view returns (uint);
    function dAssets(uint) external view returns (address);
    function debt(address, address) external view returns (uint);

    function _increaseDebt(address user, address asset, uint amount) external;
    function _decreaseDebt(address user, address asset, uint amount) external;

    function totalDebt(address account) external view returns(uint);
}