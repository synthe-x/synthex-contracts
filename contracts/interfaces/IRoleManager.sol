// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/IAccessControl.sol";

interface IRoleManager is IAccessControl{
    function SYS_ADMIN_ROLE() external view returns (bytes32);
    function ISSUER_ROLE() external view returns (bytes32);
    function COLLATERAL_MANAGER_ROLE() external view returns (bytes32);
    function DEBT_POOL_MANAGER_ROLE() external view returns (bytes32);
    function EXCHANGE_MANAGER_ROLE() external view returns (bytes32);
}