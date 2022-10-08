// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "contracts/interfaces/ISynthERC20.sol";
import "../interfaces/ISystem.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IReserve.sol";
import "../interfaces/IDebtManager.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

contract TradingPool is ERC20 {
    using SafeMath for uint;

    // account => dAsset => amount
    mapping(address => mapping(address => uint)) public debts;
    mapping(address => uint) public totalDebt;

    ISystem system;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        system = ISystem(msg.sender);
    }

    function increaseDebt(address user, address asset, uint amount) external {
        require(address(system) == msg.sender, "TradingPool: Only reserve can call enter pool");
        // mint dept pool shares
        (uint price, uint priceDecimals) = ISynthERC20(asset).get_price();
        uint dspAmount = amount.mul(price).div(10**priceDecimals);
        if(totalSupply() != 0){
            dspAmount = dspAmount.mul(totalSupply()).div(getTotalDebtUSD());
        }
        _mint(user, dspAmount);

        // add debt to user
        debts[user][asset] = debts[user][asset].add(amount);
        totalDebt[asset] = totalDebt[asset].add(amount);
        // issue tokens
        ISynthERC20(asset).issue(user, amount);
    }

    function decreaseDebt(address user, address asset, uint amount) external {
        require(address(system) == msg.sender, "TradingPool: Only reserve can call exit pool");
        // burn dept pool shares
        (uint price, uint priceDecimals) = ISynthERC20(asset).get_price();
        uint dspAmount = amount.mul(price).div(10**priceDecimals).mul(totalSupply()).div(getTotalDebtUSD());
        _burn(user, dspAmount);

        debts[user][asset] = debts[user][asset].sub(amount);
        totalDebt[asset] = totalDebt[asset].sub(amount);
        ISynthERC20(asset).burn(user, amount);
    }

    function exchange(address user, address fromAsset, uint fromAmount, address toAsset) external {
        require(address(system) == msg.sender, "TradingPool: Only reserve can call exchange");
        
        debts[user][fromAsset] = debts[user][fromAsset].sub(fromAmount);
        totalDebt[fromAsset] = totalDebt[fromAsset].sub(fromAmount);
        ISynthERC20(fromAsset).burn(user, fromAmount);

        (uint fromPrice, uint fromDecimals) = ISynthERC20(fromAsset).get_price();
        (uint toPrice, uint toDecimals) = ISynthERC20(toAsset).get_price();

        uint toAmount = fromAmount.mul(fromPrice).mul(10**toDecimals).div(toPrice).div(10**fromDecimals);
        debts[user][toAsset] = debts[user][toAsset].add(toAmount);
        totalDebt[toAsset] = totalDebt[toAsset].add(toAmount);
        ISynthERC20(toAsset).issue(user, toAmount);
    }

    function getTotalDebtUSD() public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < IDebtManager(system.dManager()).dAssetsCount(); i++){
            ISynthERC20 debtAsset = ISynthERC20(IDebtTracker(IDebtManager(system.dManager()).dAssets(i)).synth());
            (uint price, uint priceDecimals) = debtAsset.get_price();
            total += totalDebt[address(debtAsset)].mul(price).div(10**priceDecimals);
        }
        return total;
    }

    function getBorrowBalanceUSD(address account) public view returns (uint) {
        if(totalSupply() == 0){
            return 0;
        }
        return getTotalDebtUSD().mul(balanceOf(account)).div(totalSupply());
    }
}