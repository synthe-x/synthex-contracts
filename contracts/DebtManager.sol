
// SPDX-License-Identifier: MIT
pragma solidity 0.8.6;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./DebtERC20.sol";

contract DebtManager {
    using SafeMath for uint;

    ISystem public system;

    uint public dAssetsCount = 0;
    mapping (uint => address) public dAssets;
    
    constructor(ISystem _system){
        system = _system;
    }

    event NewDebtAsset(address asset);
    event IncreaseDebt(address account, address asset, uint amount);
    event DecreaseDebt(address account, address asset, uint amount);

    function create(string memory name, string memory symbol, IPriceOracle _oracle, IInterestRate _interestRateModel) public {
        require(msg.sender == system.owner(), "Not owner");
        DebtERC20 pool = new DebtERC20(name, symbol, _oracle, _interestRateModel, system);
        dAssets[dAssetsCount] = address(pool);
        dAssetsCount += 1;

        emit NewDebtAsset(address(pool));
    }

    function _increaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve() || msg.sender == system.exchanger(), "DebtManager: Not Reserve or Exchanger");
        DebtERC20(asset).borrow(user, amount);
        emit IncreaseDebt(user, asset, amount);
    }

    function _decreaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve() || msg.sender == system.exchanger(), "DebtManager: Not Reserve or Exchanger");
        DebtERC20(asset).repay(user, user, amount);
        emit DecreaseDebt(user, asset, amount);
    }

    function totalDebt(address account) public returns(uint){
        uint total = 0;
        for(uint i = 0; i < dAssetsCount; i++){
            (uint price, uint decimals) = DebtERC20(dAssets[i]).get_price();
            total += DebtERC20(dAssets[i]).getBorrowBalance(account).mul(price).div(10**decimals);
        }
        return total;
    }
}