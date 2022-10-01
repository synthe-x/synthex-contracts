// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ICollateralManager {
    function cAssetsCount() external view returns (uint);
    function cAssets(uint) external view returns (address);
    function cAssetsOracle(address) external view returns (address);
    function collateral(address, address) external view returns (uint);

    function _increaseCollateral(address user, address asset, uint amount) external;
    function _decreaseCollateral(address user, address asset, uint amount) external;

    function totalCollateral(address account) external view returns(uint);
    function get_price(address) external view returns(uint, uint);

}