// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface ICollateralManager {
    function create(string memory name, string memory symbol, uint decimals, address asset, address oracle, uint minCollateral) external;
    
    function cAssetsCount() external view returns (uint);
    function cAssets(uint) external view returns (address);
    function assetToCAsset(address _asset) external view returns (address);

    function collateral(address, address) external view returns (uint);

    function _increaseCollateral(address user, address asset, uint amount) external;
    function _decreaseCollateral(address user, address asset, uint amount) external;

    function totalCollateral(address account) external view returns(uint);
}