// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface IExchanger {
    function exchange(address, address, uint, address) external;
}