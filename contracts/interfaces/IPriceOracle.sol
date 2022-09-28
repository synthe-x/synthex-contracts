// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IPriceOracle {
    function latestAnswer() external view returns (int);
    function decimals() external view returns (uint);
}