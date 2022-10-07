// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

interface IAddressResolver {
    function repository(bytes32) external view returns (address);

    function importAddresses(bytes32[] calldata names, address[] calldata destinations) external;

    function areAddressesImported(bytes32[] calldata names, address[] calldata destinations) external view returns (bool);

    function getAddress(bytes32 name) external view returns (address);
    
    function owner() external view returns (address);
}
