    // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IPool {
    function increaseDebt(address user, address asset, uint amount) external;
    function decreaseDebt(address user, address asset, uint amount) external;
    function exchange(address user, address fromAsset, uint fromAmount, address toAsset) external;
    function transferOut(address to, address asset, uint amount) external;
    function getBorrowBalanceUSD(address account) external view returns (uint);
    function getTotalDebtUSD() external view returns(uint);
}