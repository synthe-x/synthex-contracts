// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

import "./interfaces/ISystem.sol";
import "contracts/interfaces/ISynthERC20.sol";
import "./interfaces/IReserve.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/ICollateralERC20.sol";
import "./interfaces/IDebtManager.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

contract Liquidator {
    using SafeMath for uint;
    ISystem system;
    uint reward;
    uint rewardDecimals = 1e8;
        
    constructor(ISystem _system){
        system = _system;
    }

    function liquidate(address liquidator, address user) external {
        uint dAssetsCount = IDebtManager(system.dManager()).dAssetsCount();
        for(uint i = 0; i < dAssetsCount; i++){
            address dAsset = IDebtManager(system.dManager()).dAssets(i);
            IDebtTracker(dAsset).repay(user, liquidator, type(uint).max);
        }

        uint cAssetsCount = ICollateralManager(system.cManager()).cAssetsCount();
        for(uint i = 0; i < cAssetsCount; i++){
            address cAsset = ICollateralManager(system.cManager()).cAssets(i);
            uint cAmount = ICollateralManager(system.cManager()).collateral(user, cAsset);
            IReserve(system.reserve()).transferOut(user, cAsset, cAmount);
        }
    }

    function partialLiquidate(address liquidator, address user, address borrowedAsset, uint repayAmount) external {
        require(msg.sender == address(system), "Liquidator: Only reserve can liquidate");
        
        uint repayAmountUSD = toUSD(borrowedAsset, repayAmount);
        uint cPercent = repayAmountUSD.mul(1e18).div(IDebtManager(system.dManager()).totalDebt(user));
        
        IDebtTracker(system.getDebtTracker(borrowedAsset)).repay(user, liquidator, repayAmount);
        
        uint cAssetsCount = ICollateralManager(system.cManager()).cAssetsCount();
        for(uint i = 0; i < cAssetsCount; i++){
            address cAsset = ICollateralManager(system.cManager()).cAssets(i);
            uint cAmount = ICollateralERC20(cAsset).balanceOf(user).mul(cPercent).div(1e18);
            if(cAmount > 0){
                uint cAmountUSD = toUSD(cAsset, cAmount);
                ICollateralManager(system.cManager())._decreaseCollateral(user, ICollateralERC20(cAsset).underlyingToken(), cAmount);
                IReserve(system.reserve()).transferOut(user, ICollateralERC20(cAsset).underlyingToken(), cAmount);

                // for the last collateral: repayment(borrowed+reward) will be <= cAmountUSD
                if(cAmountUSD > repayAmountUSD){
                    repayAmountUSD = repayAmountUSD.sub(repayAmountUSD);
                } else {
                    repayAmountUSD = repayAmountUSD.sub(cAmountUSD);
                }
            }
        }
        require(repayAmountUSD == 0, "Liquidator: Not enough collateral");
    }

    function toUSD(address asset, uint amount) public view returns(uint){
        (uint price, uint pricedecimals) = ISynthERC20(asset).get_price();
        return amount.mul(price).div(10**pricedecimals);
    }
}