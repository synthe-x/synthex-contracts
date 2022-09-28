// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SignedSafeMath.sol";

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./interfaces/IInterestRate.sol";


import "hardhat/console.sol";

contract SynthERC20 is 
    ERC20
{
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    ISystem system;
    IPriceOracle oracle;

    struct BorrowBalance {
        uint principle;
        uint interestIndex;
    }
    // borrow balance in oneUSD
    mapping(address => BorrowBalance) public borrowBalances;
    uint public borrowIndex;
    uint public totalBorrowed;
    uint public accrualTimestamp;
    uint borrowRateMax = 1000;
    IInterestRate interestRateModel;

    event Borrow(address indexed account, uint amount);
    event Repay(address indexed account, uint amount);
    event OracleUpdated(address oldOracle, address newOracle);
    event InterestRateModelUpdated(address oldRate, address newRate);

    constructor(
        string memory name, 
        string memory symbol, 
        ISystem _system
    ) ERC20(name, symbol) {
        system = _system;
        accrualTimestamp = block.timestamp;
        borrowIndex = 1e18;
    }

    function setPriceOracle(IPriceOracle _oracle) external {
        require(msg.sender == system.owner(), "OneERC20: Only owner can set price oracle");
        emit OracleUpdated(address(oracle), address(_oracle));
        oracle = _oracle;
    }

    function setInterestRate(IInterestRate _interestRateModel) external {
        require(msg.sender == system.owner(), "OneERC20: Only owner can set interest rate model");
        emit InterestRateModelUpdated(address(interestRateModel), address(_interestRateModel));
        interestRateModel = _interestRateModel;
    }

    function getBorrowBalance(address account) public returns(uint){
        accureInterest();
        return getBorrowBalanceStored(account);
    }

    function getBorrowBalanceStored(address account) public view returns(uint){
        uint interestIndex = borrowBalances[account].interestIndex;
        if(interestIndex == 0){
            return 0;
        }
        return borrowBalances[account].principle.mul(borrowIndex).div(interestIndex);
    }

    function accureInterest() public {
        uint currentTimestamp = block.timestamp;
        uint accrualTimestampPrior = accrualTimestamp;

        // Short-circuit accumulating 0 interest
        if (accrualTimestampPrior == currentTimestamp) {
            return;
        }

        uint borrowIndexPrior = borrowIndex;

        // Calculate the current borrow interest rate
        (uint borrowRate, uint borrowRateDecimals) = interestRateModel.getInterestRate(0);
        require(borrowRate.div(10**borrowRateDecimals) <= borrowRateMax, "borrow rate is absurdly high");

        // Calculate the number of blocks elapsed since the last accrual
        uint timestampDelta = currentTimestamp - accrualTimestampPrior;

        uint simpleInterestFactor = borrowRate * timestampDelta;
        uint interestAccumulated = (simpleInterestFactor * totalBorrowed) / 10 ** borrowRateDecimals;
        uint totalBorrowsNew = interestAccumulated + totalBorrowed;
        uint borrowIndexNew = ((simpleInterestFactor * borrowIndexPrior) / 10 ** borrowRateDecimals) + borrowIndexPrior;

        accrualTimestamp = currentTimestamp;
        borrowIndex = borrowIndexNew;
        totalBorrowed = totalBorrowsNew;
    }

    function borrow(address account, uint borrowAmount) public {
        accureInterest();
        require(msg.sender == system.dManager() || msg.sender == system.exchanger(), "OneERC20 Issue: Can only be called internally");

        uint accountBorrowsPrev = getBorrowBalanceStored(account);
        uint accountBorrowsNew = accountBorrowsPrev + borrowAmount;
        uint totalBorrowsNew = totalBorrowed + borrowAmount;

        borrowBalances[account].principle = accountBorrowsNew;
        borrowBalances[account].interestIndex = borrowIndex;
        totalBorrowed = totalBorrowsNew;

        _mint(account, borrowAmount);
    }

    function repay(address account, uint repayAmount) public {
        accureInterest();
        require(msg.sender == system.dManager() || msg.sender == system.exchanger(), "OneERC20 Issue: Can only be called internally");
        /* We fetch the amount the borrower owes, with accumulated interest */
        uint accountBorrowsPrev = getBorrowBalanceStored(account);

        /* If repayAmount == -1, repayAmount = accountBorrows */
        uint repayAmountFinal = repayAmount == type(uint).max ? accountBorrowsPrev : repayAmount;
    
        _burn(account, repayAmountFinal);

        uint accountBorrowsNew = accountBorrowsPrev - repayAmountFinal;
        uint totalBorrowsNew = totalBorrowed - repayAmountFinal;

        /* We write the previously calculated values into storage */
        borrowBalances[account].principle = accountBorrowsNew;
        borrowBalances[account].interestIndex = borrowIndex;
        totalBorrowed = totalBorrowsNew;
    }

    function get_price() public view returns (uint, uint) {
        return (uint(oracle.latestAnswer()), oracle.decimals());
    }
}