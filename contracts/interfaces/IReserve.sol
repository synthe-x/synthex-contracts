    // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IPool.sol";

interface IReserve is IPool {
    function increaseCollateral(address user, address asset, uint amount) external payable;
    function decreaseCollateral(address user, address asset, uint amount) external;
}