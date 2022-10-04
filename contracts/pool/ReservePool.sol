// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ISynthERC20.sol";
import "../interfaces/ISystem.sol";
import "../interfaces/IPriceOracle.sol";
import "../interfaces/IDebtERC20.sol";
import "../interfaces/IReserve.sol";
import "../interfaces/IDebtManager.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";

contract ReservePool is ERC20 {
    using SafeMath for uint;

    // account => asset => amount
    mapping(address => mapping(address => uint)) public debts;
    mapping(address => uint) public totalDebt;

    ISystem system;

    constructor(ISystem _system) ERC20("Synthex Pool Debt", "SPD") {
        system = _system;
    }

    function enterPool(address user, address asset, uint amount) external {
        require(system.reserve() == msg.sender, "ReservePool: Only reserve can call enter pool");
        // mint dept pool shares
        (uint price, uint priceDecimals) = IDebtERC20(asset).get_price();
        uint dspAmount = amount.mul(price).div(10**priceDecimals);
        if(totalSupply() != 0){
            dspAmount = dspAmount.mul(totalSupply()).div(getTotalDebtUSD());
        }
        _mint(user, dspAmount);

        // add debt to user
        debts[user][asset] = debts[user][asset].add(amount);
        totalDebt[asset] = totalDebt[asset].add(amount);
        // issue tokens
        ISynthERC20(IDebtERC20(asset).synth()).issue(user, amount);
    }

    function exitPool(address user, address asset, uint amount) external {
        require(system.reserve() == msg.sender, "ReservePool: Only reserve can call exit pool");
        // burn dept pool shares
        (uint price, uint priceDecimals) = IDebtERC20(asset).get_price();
        uint dspAmount = amount.mul(price).div(10**priceDecimals).mul(totalSupply()).div(getTotalDebtUSD());
        _burn(user, dspAmount);

        debts[user][asset] = debts[user][asset].sub(amount);
        totalDebt[asset] = totalDebt[asset].sub(amount);
        ISynthERC20(IDebtERC20(asset).synth()).burn(user, amount);
    }

    function exchange(address user, address fromAsset, uint fromAmount, address toAsset) external {
        require(system.reserve() == msg.sender, "ReservePool: Only reserve can call exchange");
        
        debts[user][fromAsset] = debts[user][fromAsset].sub(fromAmount);
        ISynthERC20(IDebtERC20(fromAsset).synth()).burn(user, fromAmount);

        (uint fromPrice, uint fromDecimals) = ISynthERC20(fromAsset).get_price();
        (uint toPrice, uint toDecimals) = ISynthERC20(toAsset).get_price();

        uint toAmount = fromAmount.mul(fromPrice).mul(10**toDecimals).div(fromDecimals).div(toPrice);
        debts[user][toAsset] = debts[user][toAsset].add(toAmount);
        ISynthERC20(IDebtERC20(toAsset).synth()).issue(user, toAmount);
    }

    function getTotalDebtUSD() public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < IDebtManager(system.dManager()).dAssetsCount(); i++){
            (uint price, uint priceDecimals) = IDebtERC20(IDebtManager(system.dManager()).dAssets(i)).get_price();
            total += totalDebt[IDebtManager(system.dManager()).dAssets(i)].mul(price).div(10**priceDecimals);
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