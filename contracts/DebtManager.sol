
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./SynthERC20.sol";

contract DebtManager {
    using SafeMath for uint;

    ISystem public system;

    uint public dAssetsCount = 0;
    mapping (uint => address) public dAssets;
    
    constructor(ISystem _system){
        system = _system;
    }

    event NewPool(address asset);

    function create(string memory name, string memory symbol) public {
        require(msg.sender == system.owner(), "Not owner");
        SynthERC20 pool = new SynthERC20(name, symbol, system);
        dAssets[dAssetsCount] = address(pool);
        dAssetsCount += 1;

        emit NewPool(address(pool));
    }

    function _increaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve() || msg.sender == system.exchanger(), "DebtManager: Not Reserve or Exchanger");
        SynthERC20(asset).borrow(user, amount);
    }

    function _decreaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve() || msg.sender == system.exchanger(), "DebtManager: Not Reserve or Exchanger");
        SynthERC20(asset).repay(user, user, amount);
    }

    function totalDebt(address account) public returns(uint){
        uint total = 0;
        for(uint i = 0; i < dAssetsCount; i++){
            (uint price, uint decimals) = SynthERC20(dAssets[i]).get_price();
            total += SynthERC20(dAssets[i]).getBorrowBalance(account).mul(price).div(10**decimals);
        }
        return total;
    }
}