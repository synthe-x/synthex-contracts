// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.9;

import "./interfaces/ISystem.sol";
import "./interfaces/ISynthERC20.sol";
import "./interfaces/IReserve.sol";
import "./interfaces/ICollateralManager.sol";
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
            ISynthERC20(dAsset).repay(user, liquidator, type(uint).max);
        }

        uint cAssetsCount = ICollateralManager(system.cManager()).cAssetsCount();
        for(uint i = 0; i < cAssetsCount; i++){
            address cAsset = ICollateralManager(system.cManager()).cAssets(i);
            uint cAmount = ICollateralManager(system.cManager()).collateral(user, cAsset);
            IReserve(system.reserve()).transferOut(user, cAsset, cAmount);
        }
    }

    function partialLiquidate(address liquidator, address user, address borrowedAsset, uint repayAmount) external {
        require(msg.sender == system.reserve(), "Liquidator: Only reserve can liquidate");
        

        uint repayAmountUSD = multiplyByPrice(repayAmount, borrowedAsset);
        uint cPercent = repayAmountUSD.mul(1e18).div(IDebtManager(system.dManager()).totalDebt(user));
        ISynthERC20(borrowedAsset).repay(user, liquidator, repayAmount);

        for(uint i = 0; i < ICollateralManager(system.cManager()).cAssetsCount(); i++){
            address cAsset = ICollateralManager(system.cManager()).cAssets(i);
            uint cAmount = ICollateralManager(system.cManager()).collateral(user, cAsset).mul(cPercent).div(1e18);
            if(cAmount > 0){
                (uint cPrice, uint cDecimals) = ICollateralManager(system.cManager()).get_price(cAsset);
                uint cAmountUSD = cAmount.mul(cPrice).div(10**cDecimals);
                ICollateralManager(system.cManager())._decreaseCollateral(user, cAsset, cAmount);
                IReserve(system.reserve()).transferOut(user, cAsset, cAmount);

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

    function multiplyByPrice(uint amount, address asset) internal view returns(uint){
        (uint price, uint decimals) = ISynthERC20(asset).get_price();
        return amount.mul(price).div(10**decimals);
    }
}