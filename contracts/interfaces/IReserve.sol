    // SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IReserve {
    function collateralRatio(address account) external returns(uint);
    
    function cRatioDecimals() external returns(uint);
    function transferOut(address to, address asset, uint amount) external;

    function minCRatio() external view returns (uint);
    function safeCRatio() external view returns (uint);

}