// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.9;

interface ILiquidator {
    function liquidate(address liquidator, address user) external;
    function partialLiquidate(address liquidator, address user, address borrowedAsset, uint borrowedAmount) external;
}