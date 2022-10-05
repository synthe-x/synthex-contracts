// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.6;

interface IInterestRate {
    function setInterestRate(uint _interestRate, uint _interestRateDecimals) external;
    function getInterestRate(uint) external view returns(uint, uint);
}