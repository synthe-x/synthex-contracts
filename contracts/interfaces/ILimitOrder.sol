// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface ILimitOrder {
    function verifyOrder(address maker, address src, address dst, uint256 srcAmount, bytes memory signature) external view returns(bool);
}