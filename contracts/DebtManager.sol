
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./interfaces/IDebtManager.sol";

import "./DebtTracker.sol";

contract DebtManager is IDebtManager {
    using SafeMath for uint;

    ISystem public system;

    uint private _dAssetsCount;
    mapping(uint => address) private _dAssets;
    mapping(address => address) private _assetToDAsset;
    
    constructor(ISystem _system){
        system = _system;
        _dAssetsCount = 0;
    }

    function dAssetsCount() external view override returns (uint) {
        return _dAssetsCount;
    }

    function dAssets(uint _index) external view override returns (address) {
        return _dAssets[_index];
    }

    function assetToDAsset(address _asset) external view override returns (address) {
        return _assetToDAsset[_asset];
    }

    function create(string memory name, string memory symbol, address _oracle, address _interestRateModel) public override returns(address) {
        require(msg.sender == address(system), "Not owner");
        DebtTracker dAsset = new DebtTracker(name, symbol, _oracle, _interestRateModel, system);
        
        _dAssets[_dAssetsCount] = address(dAsset);
        _dAssetsCount += 1;

        address synth = address(dAsset.synth());
        _assetToDAsset[synth] = address(dAsset);

        return synth;
    }

    function _increaseDebt(address user, address asset, uint amount) external override {
        require(msg.sender == system.reserve(), "DebtManager: Not Reserve or Exchanger");
        DebtTracker(_assetToDAsset[asset]).borrow(user, amount);
    }

    function _decreaseDebt(address user, address asset, uint amount) external override {
        require(msg.sender == system.reserve(), "DebtManager: Not Reserve or Exchanger");
        DebtTracker(_assetToDAsset[asset]).repay(user, user, amount);
    }

    function totalDebt(address account) public view override returns(uint){
        uint total = 0;
        for(uint i = 0; i < _dAssetsCount; i++){
            DebtTracker dt = DebtTracker(_dAssets[i]);
            total += dt.getBorrowBalanceStored(account).mul(dt.get_price()).div(10**8);
        }
        return total;
    }

    function debt(address user, address asset) public view override returns(uint){
        return DebtTracker(_assetToDAsset[asset]).getBorrowBalanceStored(user);
    }

    function dAssetToAsset(address dAsset) external view returns(address){
        return address(DebtTracker(dAsset).synth());
    }
}