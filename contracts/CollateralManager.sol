// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract CollateralManager {
    using SafeMath for uint;

    ISystem public system;

    uint public minCRatio;

    uint public cAssetsCount = 0;
    mapping (uint => address) public cAssets;
    mapping (address => address) public cAssetsOracle;

    mapping(address => mapping(address => uint)) public collateral;

    constructor(ISystem _system){
        system = _system;
    }

    function setMinCRatio(uint _minCRatio) public {
        require(msg.sender == system.owner(), "Not owner");
        minCRatio = _minCRatio;
    }

    function _increaseCollateral(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve(), "Not reserve");
        collateral[user][asset] += amount;
    }

    function _decreaseCollateral(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve(), "Not reserve");
        collateral[user][asset] -= amount;
    }

    function addCollateralAsset(address asset, address oracle) public {
        cAssets[cAssetsCount] = asset;
        cAssetsOracle[asset] = oracle;

        cAssetsCount += 1;
    }

    function totalCollateral(address account) public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < cAssetsCount; i++){
            total += collateral[account][cAssets[i]].mul(
                uint(IPriceOracle(cAssetsOracle[cAssets[i]]).latestAnswer())).div(
                10**IPriceOracle(cAssetsOracle[cAssets[i]]).decimals());
        }
        return total;
    }

    function get_price(address asset) public view returns(uint, uint){
        return (uint(IPriceOracle(cAssetsOracle[asset]).latestAnswer()), IPriceOracle(cAssetsOracle[asset]).decimals());
    }
}