// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./interfaces/ICollateralERC20.sol";
import "./interfaces/ICollateralManager.sol";
import "./CollateralERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract CollateralManager is ICollateralManager {
    using SafeMath for uint;

    ISystem public system;

    uint private _cAssetsCount = 0;
    mapping (uint => address) private _cAssets;
    mapping(address => address) private _assetToCAsset;
    
    constructor(ISystem _system){
        system = _system;
    }

    function cAssets(uint _index) external view override returns (address) {
        return _cAssets[_index];
    }

    function cAssetsCount() external view override returns (uint) {
        return _cAssetsCount;
    }

    function assetToCAsset(address _asset) external view override returns (address) {
        return _assetToCAsset[_asset];
    }

    function create(string memory name, string memory symbol, uint decimals, address asset, address oracle, uint minCollateral) public override {
        require(msg.sender == address(system), "Only system can create");
        CollateralERC20 cAsset = new CollateralERC20(name, symbol, decimals, asset, oracle, minCollateral, system);
        _cAssets[_cAssetsCount] = address(cAsset);
        _assetToCAsset[asset] = address(cAsset);
        _cAssetsCount += 1;
    }

    function _increaseCollateral(address user, address asset, uint amount) external override {
        require(msg.sender == system.reserve(), "CollateralManager: Not reserve");
        ICollateralERC20(_assetToCAsset[asset]).mint(user, amount);
    }

    function _decreaseCollateral(address user, address asset, uint amount) external override {
        require(msg.sender == system.reserve() || msg.sender == system.liquidator(), "CollateralManager: Not reserve or liquidator");
        ICollateralERC20(_assetToCAsset[asset]).burn(user, amount);
    }

    function collateral(address user, address asset) public view override returns(uint){
        return ICollateralERC20(_assetToCAsset[asset]).balanceOf(user);
    }

    // USD Amount (multiplied by 10**8)
    function totalCollateral(address account) public view override returns(uint){
        uint total = 0;
        for(uint i = 0; i < _cAssetsCount; i++){
            ICollateralERC20 asset = ICollateralERC20(_cAssets[i]);
            uint price = asset.get_price();
            uint decimals = uint(asset.decimals());
            uint balance = asset.balanceOf(account);
            total += balance.mul(price).mul(1e18).div(10**decimals).div(1e8);
        }
        return total;
    }
}