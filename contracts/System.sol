// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.9;

import "./interfaces/IRoleManager.sol";
import "./interfaces/IAddressResolver.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

contract System {
    bool private ExchangePaused = false;
    bool private IssuancePaused = false;

    IAddressResolver _addrResolver;

    mapping(address => bool) public isReservePool;

    constructor(address addrResolver) {
        _addrResolver = IAddressResolver(addrResolver);
    }

    modifier onlySysAdmin() {
        require(owner() == msg.sender, "System: Only Admin can call this function");
        _;
    }

    function setReservePool(address pool, bool status) external onlySysAdmin {
        isReservePool[pool] = status;
    }

    function owner() public view returns (address) {
        return _addrResolver.owner();
    }

    function isExchangePaused() external view returns (bool) {
        return ExchangePaused;
    }

    function isIssuancePaused() external view returns (bool) {
        return IssuancePaused;
    }

    function pauseExchange() external onlySysAdmin {
        ExchangePaused = true;
    }

    function resumeExchange() external onlySysAdmin {
        ExchangePaused = false;
    }

    function pauseIssuance() external onlySysAdmin {
        IssuancePaused = true;
    }

    function resumeIssuance() external onlySysAdmin {
        IssuancePaused = false;
    }

    function reserve() external view returns (address){
        return _addrResolver.getAddress("RESERVE");
    }
    
    function cManager() external view returns (address){
        return _addrResolver.getAddress("COLLATERAL_MANAGER");
    }
    
    function dManager() external view returns (address){
        return _addrResolver.getAddress("DEBT_MANAGER");
    }
    
    function exchanger() external view returns (address){
        return _addrResolver.getAddress("EXCHANGER");
    }

    function liquidator() external view returns (address){
        return _addrResolver.getAddress("LIQUIDATOR");
    }
}