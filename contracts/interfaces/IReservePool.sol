// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


interface IReservePool is IERC20 {
    function totalDebt(address asset) external view returns(uint);
    function debts(address user, address asset) external view returns(uint);

    function enterPool(address user, address asset, uint amount) external;

    function exitPool(address user, address asset, uint amount) external;

    function exchange(address user, address fromAsset, uint fromAmount, address toAsset) external;

    function getTotalDebtUSD() external view returns(uint);

    function getBorrowBalanceUSD(address account) external view returns (uint);
}