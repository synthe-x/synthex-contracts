// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

import "../interfaces/ISystem.sol";

contract MockInterestRateModel {
    ISystem system;

    // Interest rate per second
    uint interestRate;
    uint interestRateDecimals;

    constructor(ISystem _system){
        system = _system;
    }

    // x = interest rate per second
    // y = interest rate per year
    // x = (y+1)**(1/31536000) - 1
    // 1 % APR = 0.000000021979553066 % APS
    function setInterestRate(uint _interestRate) external {
        require(system.owner() == msg.sender, "FixedInterestRate: Only owner can set interest rate");
        interestRate = _interestRate;
    }

    function getInterestRate(uint) external view returns(uint){
        return (interestRate);
    }
}