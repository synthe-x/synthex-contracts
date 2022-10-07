// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICollateralERC20 is IERC20 {
    function setPriceOracle(address _oracle) external;
    function setMinCollateral(uint) external;
    
    function mint(address account, uint amount) external;
    function burn(address account, uint amount) external;

    function get_price() external view returns (uint, uint);
    function underlyingToken() external view returns (address);
}