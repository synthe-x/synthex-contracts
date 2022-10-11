// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

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

    function create(string memory name, string memory symbol, uint decimals, address asset, IPriceOracle oracle, uint minCollateral) public {
        require(msg.sender == address(system), "Only system can create");
        CollateralERC20 cAsset = new CollateralERC20(name, symbol, decimals, asset, oracle, minCollateral, system);
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

    // USD Amount (multiplied by 10**8)
    function totalCollateral(address account) public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < cAssetsCount; i++){
            total += ICollateralERC20(cAssets[i]).balanceOf(account).mul(ICollateralERC20(cAssets[i]).get_price()).mul(1e18).div(10**uint(ICollateralERC20(cAssets[i]).decimals())).div(1e8);
        }
        return total;
    }
}