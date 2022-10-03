// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDebtERC20 is IERC20 {
    function setPriceOracle(address _oracle) external;
    function setInterestRate(address _interestRateModel) external;

    function getBorrowBalance(address account) external returns(uint);
    function getBorrowBalanceStored(address account) external view returns(uint);
    function accureInterest() external;
    
    function borrow(address account, uint amount) external;
    function repay(address account, address caller, uint amount) external;

    function get_price() external view returns (uint, uint);
    function get_interest_rate() external view returns (uint, uint);
}