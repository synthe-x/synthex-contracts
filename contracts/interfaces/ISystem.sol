// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.9;

interface ISystem {
    // Address resolver
    function _addrResolver() external view returns (address);

    // System status
    function isExchangePaused() external view returns (bool);

    function isIssuancePaused() external view returns (bool);

    // Addresses
    function owner() external view returns (address);

    function reserve() external view returns (address);
    
    function cManager() external view returns (address);
    
    function dManager() external view returns (address);
    
    function exchanger() external view returns (address);
}