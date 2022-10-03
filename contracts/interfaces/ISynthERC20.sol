// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IDebtERC20.sol";

interface ISynthERC20 is IERC20 {
    function issue(address account, uint amount) external;
    function debt() external view returns(IDebtERC20);

    function burn(address account, uint amount) external;
}