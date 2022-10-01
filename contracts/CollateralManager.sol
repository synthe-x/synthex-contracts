// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./interfaces/ICollateralERC20.sol";
import "./CollateralERC20.sol";


import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract CollateralManager {
    using SafeMath for uint;

    ISystem public system;

    uint public cAssetsCount = 0;
    mapping (uint => address) public cAssets;

    mapping(address => address) public assetToCAsset;

    constructor(ISystem _system){
        system = _system;
    }

    function create(string memory name, string memory symbol, address asset, IPriceOracle oracle, uint minCollateral) public {
        CollateralERC20 cAsset = new CollateralERC20(name, symbol, asset, oracle, minCollateral, system);
        cAssets[cAssetsCount] = address(cAsset);
        assetToCAsset[asset] = address(cAsset);
        cAssetsCount += 1;
    }

    function _increaseCollateral(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve(), "CollateralManager: Not reserve");
        ICollateralERC20(assetToCAsset[asset]).mint(user, amount);
    }

    function _decreaseCollateral(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve() || msg.sender == system.liquidator(), "CollateralManager: Not reserve or liquidator");
        ICollateralERC20(assetToCAsset[asset]).burn(user, amount);
    }

    function collateral(address user, address asset) public view returns(uint){
        return ICollateralERC20(assetToCAsset[asset]).balanceOf(user);
    }

    function totalCollateral(address account) public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < cAssetsCount; i++){
            (uint price, uint priceDecimals) = ICollateralERC20(cAssets[i]).get_price();
            total += ICollateralERC20(cAssets[i]).balanceOf(account).mul(price).div(10**priceDecimals);
        }
        return total;
    }
}