// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

import "./interfaces/ISystem.sol";
import "./interfaces/IExchanger.sol";
import "./interfaces/IDebtManager.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/ICollateralERC20.sol";

import "contracts/interfaces/IReserve.sol";
import "./interfaces/IReservePool.sol";

import "contracts/interfaces/ISynthERC20.sol";

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "hardhat/console.sol";

contract Helper {
    using SafeMath for uint;
    
    struct AssetInfo {
        address id;
        string name;
        string symbol;
        uint decimals;
        uint price;
        uint priceDecimals;
        uint totalLiquidity;
        uint interestRate;
        uint interestRateDecimals;
    }

    struct UserPosition {
        address id;
        uint collateralBalance;
        Position[] collaterals;
        uint debtBalance;
        Position[] debts;
        uint poolBalance;
        Position[] poolAssets;
    }

    struct Position {
        AssetInfo asset;
        uint amount;
        uint walletBalance;
    }

    ISystem public system;

    constructor(ISystem _system) {
        system = _system;
    }

    function getAllAssets() public view returns(AssetInfo[] memory, AssetInfo[] memory){
        return (getCollateralAssets(), getDebtAssets());
    }

    function dAssetToAsset(address dAsset) public view returns(address){
        return IDebtTracker(dAsset).synth();
    }

    

    /* -------------------------------------------------------------------------- */
    /*                               Debt Assets                                  */
    /* -------------------------------------------------------------------------- */

    function getDebtAssets() public view returns(AssetInfo[] memory){
        AssetInfo[] memory response = new AssetInfo[](IDebtManager(system.dManager()).dAssetsCount());
        for(uint i = 0; i < response.length; i++){
            response[i] = getDebtAsset(i);
        }
        return response;
    }
    
    function getDebtAsset(uint index) public view returns(AssetInfo memory){
        AssetInfo memory response;
        IDebtTracker debtAsset = IDebtTracker(IDebtManager(system.dManager()).dAssets(index));
        response.id = debtAsset.synth();
        response.name = IERC20Metadata(response.id).name();
        response.symbol = IERC20Metadata(response.id).symbol();
        response.decimals = IERC20Metadata(response.id).decimals();
        response.totalLiquidity = IERC20Metadata(response.id).totalSupply();
        (response.price, response.priceDecimals) = ISynthERC20(response.id).get_price();
        (response.interestRate, response.interestRateDecimals) = debtAsset.get_interest_rate();
        return response;
    }

    function getDebtAssetPrices() public view returns(uint[] memory){
        uint[] memory response = new uint[](IDebtManager(system.dManager()).dAssetsCount());
        for(uint i = 0; i < response.length; i++){
            IDebtTracker asset = IDebtTracker(IDebtManager(system.dManager()).dAssets(i));
            (uint price, uint decimals) = asset.get_price();
            response[i] = price;
        }
        return response;
    }

    function getDebtAssetAddresses() public view returns(address[] memory){
        address[] memory response = new address[](IDebtManager(system.dManager()).dAssetsCount());
        for(uint i = 0; i < response.length; i++){
            response[i] = IDebtTracker(IDebtManager(system.dManager()).dAssets(i)).synth();
        }
        return response;
    }

    function getDebtPositionArray(address user) public view returns(uint[] memory){
        uint[] memory response = new uint[](IDebtManager(system.dManager()).dAssetsCount());
        for(uint i = 0; i < response.length; i++){
            response[i] = IDebtTracker(IDebtManager(system.dManager()).dAssets(i)).getBorrowBalanceStored(user);
        }
        return response;
    }

    /* -------------------------------------------------------------------------- */
    /*                              Collateral Assets                             */
    /* -------------------------------------------------------------------------- */

    function getCollateralAssets() public view returns(AssetInfo[] memory){
        AssetInfo[] memory response = new AssetInfo[](ICollateralManager(system.cManager()).cAssetsCount());
        for(uint i = 0; i < response.length; i++){
            response[i] = getCollateralAsset(i);
        }
        return response;
    }

    function getCollateralAssetAddresses() public view returns(address[] memory){
        address[] memory response = new address[](ICollateralManager(system.cManager()).cAssetsCount());
        for(uint i = 0; i < response.length; i++){
            response[i] = ICollateralERC20(ICollateralManager(system.cManager()).cAssets(i)).underlyingToken();
        }
        return response;
    }

    function getCollateralAsset(uint index) public view returns(AssetInfo memory) {
        AssetInfo memory response;
        response.id =  ICollateralERC20(ICollateralManager(system.cManager()).cAssets(index)).underlyingToken();
        if(response.id == address(0)){
            response.name = "Ethereum";
            response.symbol = "ETH";
            response.decimals = 18;
            response.totalLiquidity = system.reserve().balance;
        } else {
            response.name = IERC20Metadata(response.id).name();
            response.symbol = IERC20Metadata(response.id).symbol();
            response.decimals = IERC20Metadata(response.id).decimals();
            response.totalLiquidity = IERC20Metadata(response.id).balanceOf(system.reserve());
        }
        (response.price, response.priceDecimals) = ICollateralERC20(ICollateralManager(system.cManager()).cAssets(index)).get_price();
        return response;
    }

    function getCollateralAssetPrices(address user) public view returns(uint[] memory){
        uint[] memory response = new uint[](ICollateralManager(system.cManager()).cAssetsCount());
        for(uint i = 0; i < response.length; i++){
            ICollateralERC20 asset = ICollateralERC20(ICollateralManager(system.cManager()).cAssets(i));
            (uint price, uint priceDecimals) = asset.get_price();
            response[i] = price;
        }
        return response;
    }

    // [[amount, price, priceDecimals], ...]
    function getCollateralPositionArray(address user) public view returns(uint[] memory){
        uint[] memory response = new uint[](ICollateralManager(system.cManager()).cAssetsCount());
        for(uint i = 0; i < response.length; i++){
            ICollateralERC20 asset = ICollateralERC20(ICollateralManager(system.cManager()).cAssets(i));
            response[i] = ICollateralManager(system.cManager()).collateral(user, asset.underlyingToken());
        }
        return response;
    }

    /* -------------------------------------------------------------------------- */
    /*                                User Position                               */
    /* -------------------------------------------------------------------------- */
    function getUserPosition(address user) public returns(UserPosition memory){
        UserPosition memory response = UserPosition({
            id: user,
            collateralBalance: ICollateralManager(system.cManager()).totalCollateral(user),
            collaterals: new Position[](ICollateralManager(system.cManager()).cAssetsCount()),
            debtBalance: IDebtManager(system.dManager()).totalDebt(user),
            debts: new Position[](IDebtManager(system.dManager()).dAssetsCount()),
            poolBalance: 0,
            poolAssets: new Position[](IDebtManager(system.dManager()).dAssetsCount())
        });

        for(uint i = 0; i < response.collaterals.length; i++){
            response.collaterals[i].asset = getCollateralAsset(i);
            response.collaterals[i].amount = ICollateralManager(system.cManager()).collateral(user, response.collaterals[i].asset.id);
            if(response.collaterals[i].asset.id == address(0)){
                response.collaterals[i].walletBalance = user.balance;
            } else {
                response.collaterals[i].walletBalance = IERC20Metadata(response.collaterals[i].asset.id).balanceOf(user);
            }
        }

        for(uint i = 0; i < response.debts.length; i++){
            response.debts[i].asset = getDebtAsset(i);
            response.poolAssets[i].asset = getDebtAsset(i);
            response.debts[i].amount = IDebtTracker(IDebtManager(system.dManager()).dAssets(i)).getBorrowBalance(user);
            response.debts[i].walletBalance = IERC20Metadata(response.debts[i].asset.id).balanceOf(user);
            response.poolAssets[i].walletBalance = IERC20Metadata(response.debts[i].asset.id).balanceOf(user);
        }

        // for(uint i = 1; i <= IReserve(system.reserve()).poolCount(); i++){
        //     IReservePool pool = IReservePool(IReserve(system.reserve()).pools(i));
        //     for(uint j = 0; j < response.poolAssets.length; j++){
        //         response.poolAssets[j].amount = response.poolAssets[j].amount.add(pool.debts(user, address(ISynthERC20(response.poolAssets[j].asset.id).debt())));   
        //     }
        // }

        return response;
    }
}