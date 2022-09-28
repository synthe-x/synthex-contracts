// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.9;

import "./interfaces/ISystem.sol";
import "./interfaces/IExchanger.sol";
import "./interfaces/IDebtManager.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/IReserve.sol";
import "./interfaces/ISynthERC20.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract Helper {

    struct CollateralAssetInfo {
        address id;
        string name;
        string symbol;
        uint decimals;
        uint price;
        uint priceDecimals;
    }

    struct DebtAssetInfo {
        address id;
        string name;
        string symbol;
        uint decimals;
        uint price;
        uint priceDecimals;
    }

    ISystem public system;

    constructor(ISystem _system) {
        system = _system;
    }

    function getCollateralAssets() public view returns(CollateralAssetInfo[] memory){
        CollateralAssetInfo[] memory response = new CollateralAssetInfo[](ICollateralManager(system.cManager()).cAssetsCount());
        for(uint i = 0; i < response.length; i++){
            response[i].id = ICollateralManager(system.cManager()).cAssets(i);
            if(response[i].id == address(0)){
                response[i].name = "Ethereum";
                response[i].symbol = "ETH";
                response[i].decimals = 18;
            } else {
                response[i].name = IERC20Metadata(response[i].id).name();
                response[i].symbol = IERC20Metadata(response[i].id).symbol();
                response[i].decimals = IERC20Metadata(response[i].id).decimals();
            }
            (response[i].price, response[i].priceDecimals) = ICollateralManager(system.cManager()).get_price(response[i].id);
        }
        return response;
    }

    function getDebtAssets() public view returns(DebtAssetInfo[] memory){
        DebtAssetInfo[] memory response = new DebtAssetInfo[](IDebtManager(system.dManager()).dAssetsCount());
        for(uint i = 0; i < response.length; i++){
            response[i].id = IDebtManager(system.dManager()).dAssets(i);
            response[i].name = IERC20Metadata(response[i].id).name();
            response[i].symbol = IERC20Metadata(response[i].id).symbol();
            response[i].decimals = IERC20Metadata(response[i].id).decimals();
            (response[i].price, response[i].priceDecimals) = ISynthERC20(response[i].id).get_price();
        }
        return response;
    }
}