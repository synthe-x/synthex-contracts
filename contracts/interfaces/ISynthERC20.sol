// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "contracts/interfaces/IDebtTracker.sol";

interface ISynthERC20 is IERC20 {
    function issue(address account, uint amount) external;
    function debt() external view returns(IDebtTracker);

    function burn(address account, uint amount) external;
    function get_price() external view returns (uint, uint);
}