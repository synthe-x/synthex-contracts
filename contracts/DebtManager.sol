
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./DebtTracker.sol";

contract DebtManager {
    using SafeMath for uint;

    ISystem public system;

    uint public dAssetsCount = 0;
    mapping (uint => address) public dAssets;
    mapping(address => address) public assetToDAsset;
    
    constructor(ISystem _system){
        system = _system;
    }

    function create(string memory name, string memory symbol, IPriceOracle _oracle, IInterestRate _interestRateModel) public returns(address) {
        require(msg.sender == address(system), "Not owner");
        DebtTracker dAsset = new DebtTracker(name, symbol, _oracle, _interestRateModel, system);
        
        dAssets[dAssetsCount] = address(dAsset);
        dAssetsCount += 1;

        address synth = address(dAsset.synth());
        assetToDAsset[synth] = address(dAsset);

        return synth;
    }

    function _increaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve(), "DebtManager: Not Reserve or Exchanger");
        DebtTracker(assetToDAsset[asset]).borrow(user, amount);
    }

    function _decreaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve(), "DebtManager: Not Reserve or Exchanger");
        DebtTracker(assetToDAsset[asset]).repay(user, user, amount);
    }

    function totalDebt(address account) public returns(uint){
        uint total = 0;
        for(uint i = 0; i < dAssetsCount; i++){
            (uint price, uint priceDecimals) = DebtTracker(dAssets[i]).get_price();
            total += DebtTracker(dAssets[i]).getBorrowBalance(account).mul(price).div(10**priceDecimals);
        }
        return total;
    }

    function totalDebtStored(address account) public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < dAssetsCount; i++){
            (uint price, uint priceDecimals) = DebtTracker(dAssets[i]).get_price();
            total += DebtTracker(dAssets[i]).getBorrowBalanceStored(account).mul(price).div(10**priceDecimals);
        }
        return total;
    }
}