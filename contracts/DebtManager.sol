
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./OneERC20.sol";

contract DebtManager {
    using SafeMath for uint;

    ISystem public system;

    uint public dAssetsCount = 0;
    mapping (uint => address) public dAssets;
    
    mapping(address => mapping(address => uint)) public debt;

    constructor(ISystem _system){
        system = _system;
    }

    event NewPool(address asset);

    function create(string memory name, string memory symbol) public {
        OneERC20 pool = new OneERC20(name, symbol, system);
        dAssets[dAssetsCount] = address(pool);
        dAssetsCount += 1;

        emit NewPool(address(pool));
    }

    function _increaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve(), "Not reserve");
        debt[user][asset] += amount;
        OneERC20(asset).issue(user, amount);
    }

    function _decreaseDebt(address user, address asset, uint amount) external {
        require(msg.sender == system.reserve(), "Not reserve");
        debt[user][asset] -= amount;
        OneERC20(asset).burn(user, amount);
    }

    function totalDebt(address account) public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < dAssetsCount; i++){
            total += debt[account][dAssets[i]].mul(OneERC20(dAssets[i]).get_price()).div(10**OneERC20(dAssets[i]).priceDecimals());
        }
        return total;
    }
}