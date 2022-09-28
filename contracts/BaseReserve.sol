// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/ISynthERC20.sol";
import "./interfaces/IReserve.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/IDebtManager.sol";
import "./interfaces/ISystem.sol";
import "./interfaces/IExchanger.sol";


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract BaseReserve {
    using SafeMath for uint;
    
    ISystem system;

    function _exchangeInternal(address src, uint srcAmount, address dst) internal {
        IExchanger(system.exchanger()).exchange(msg.sender, src, srcAmount, dst);
    }

    function _increaseCollateralInternal(address user, address asset, uint amount) internal {
        if(asset != address(0)){
            IERC20(asset).transferFrom(user, address(this), amount);
        } else {
            amount = msg.value;
        }
        ICollateralManager(system.cManager())._increaseCollateral(user, asset, amount);
    }

    function _decreaseCollateralInternal(address user, address asset, uint amount) internal {
        ICollateralManager(system.cManager())._decreaseCollateral(user, asset, amount);
        require(collateralRatio(user) > ICollateralManager(system.cManager()).minCRatio(), "cRatio too low");
        if(asset == address(0)){
            payable(user).transfer(amount);
        } else {
            IERC20(asset).transfer(msg.sender, amount);
        }
    }

    function _borrowInternal(address asset, uint amount) internal {
        IDebtManager(system.dManager())._increaseDebt(msg.sender, asset, amount);
        require(collateralRatio(msg.sender) > ICollateralManager(system.cManager()).minCRatio(), "cRatio too low");
    }

    function _repayInternal(address token, uint amount) internal {
        IDebtManager(system.dManager())._decreaseDebt(msg.sender, token, amount);
    }

    function _liquidateInternal(address user, uint amount) internal {
        require(collateralRatio(user) < ICollateralManager(system.cManager()).minCRatio(), "cRatio too high");
        require(amount > 0);
    }

    function collateralRatio(address account) public returns(uint){
        uint256 _debt = IDebtManager(system.dManager()).totalDebt(account);
        if(_debt == 0){
            return 2**256 - 1;
        }
        return ICollateralManager(system.cManager()).totalCollateral(account).mul(1e18).div(_debt);
    }
}
