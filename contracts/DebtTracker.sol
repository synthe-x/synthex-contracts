// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

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
import "./SynthERC20.sol";

import "hardhat/console.sol";

contract DebtTracker {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    ISystem system;
    
    struct BorrowBalance {
        uint principle;
        uint interestIndex;
    }

    // borrow balance in oneUSD
    mapping(address => BorrowBalance) public borrowBalances;
    uint public borrowIndex;
    uint public totalBorrowed;
    uint public accrualTimestamp;
    uint public borrowRateMax = 1000;
    IInterestRate public interestRateModel;

    event AccureInterest(uint accrualTimestamp, uint totalBorrowed, uint borrowIndex);
    event InterestRateModelUpdated(address oldRate, address newRate);
    
    SynthERC20 public synth;

    constructor(
        string memory name, 
        string memory symbol, 
        IPriceOracle _oracle,
        IInterestRate _interestRateModel,
        ISystem _system
    ) {
        synth = new SynthERC20(name, symbol, _system, _oracle);
        system = _system;
        accrualTimestamp = block.timestamp;
        borrowIndex = 1e18;
        interestRateModel = _interestRateModel;
    }

    function setInterestRate(IInterestRate _interestRateModel) external {
        require(msg.sender == system.owner(), "OneERC20: Only owner can set interest rate model");
        interestRateModel = _interestRateModel;
        emit InterestRateModelUpdated(address(interestRateModel), address(_interestRateModel));
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
        (uint borrowRate, uint borrowRateDecimals) = get_interest_rate();
        require(borrowRate.div(10**borrowRateDecimals) <= borrowRateMax, "DebtTracker: Borrow rate is absurdly high");

        // Calculate the number of blocks elapsed since the last accrual
        uint timestampDelta = currentTimestamp - accrualTimestampPrior;

        uint simpleInterestFactor = borrowRate.mul(timestampDelta);
        uint interestAccumulated = simpleInterestFactor.mul(totalBorrowed).div(10 ** borrowRateDecimals);
        uint totalBorrowsNew = interestAccumulated.add(totalBorrowed);
        uint borrowIndexNew = (simpleInterestFactor.mul(borrowIndexPrior).div(10 ** borrowRateDecimals)).add(borrowIndexPrior);

        accrualTimestamp = currentTimestamp;
        borrowIndex = borrowIndexNew;
        totalBorrowed = totalBorrowsNew;

        emit AccureInterest(accrualTimestamp, totalBorrowed, borrowIndex);
    }

    function borrow(address account, uint borrowAmount) public {
        accureInterest();
        require(msg.sender == system.dManager(), "DebtTracker: Issue can only be called internally");

        uint accountBorrowsPrev = getBorrowBalanceStored(account);
        uint accountBorrowsNew = accountBorrowsPrev + borrowAmount;
        uint totalBorrowsNew = totalBorrowed + borrowAmount;

        borrowBalances[account].principle = accountBorrowsNew;
        borrowBalances[account].interestIndex = borrowIndex;
        totalBorrowed = totalBorrowsNew;

        synth.issue(account, borrowAmount);
    }

    function repay(address user, address caller, uint repayAmount) public {
        accureInterest();
        require(msg.sender == system.dManager() || msg.sender == system.liquidator(), "OneERC20 Issue: Can only be called internally");
        /* We fetch the amount the borrower owes, with accumulated interest */
        uint accountBorrowsPrev = getBorrowBalanceStored(user);

        /* If repayAmount == -1, repayAmount = accountBorrows */
        uint repayAmountFinal = repayAmount == type(uint).max ? accountBorrowsPrev : repayAmount;
        synth.burn(caller, repayAmountFinal);

        uint accountBorrowsNew = accountBorrowsPrev - repayAmountFinal;
        uint totalBorrowsNew = totalBorrowed - repayAmountFinal;

        /* We write the previously calculated values into storage */
        borrowBalances[user].principle = accountBorrowsNew;
        borrowBalances[user].interestIndex = borrowIndex;
        totalBorrowed = totalBorrowsNew;
    }

    function get_interest_rate() public view returns (uint, uint) {
        return interestRateModel.getInterestRate(get_price(), 8);
    }

    function get_price() public view returns (uint) {
        return synth.get_price();
    }
}