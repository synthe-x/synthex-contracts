// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

import "./interfaces/IAddressResolver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AddressResolver is IAddressResolver, Ownable {
    mapping(bytes32 => address) private _repository;

    function repository(bytes32 _key) external view override returns (address) {
        return _repository[_key];
    }

    function importAddresses(bytes32[] calldata names, address[] calldata destinations) external override onlyOwner {
        require(names.length == destinations.length, "AddressResolver: Input lengths must match");

        for (uint i = 0; i < names.length; i++) {
            bytes32 name = names[i];
            address destination = destinations[i];
            _repository[name] = destination;
            emit AddressImported(name, destination);
        }
    }

    function areAddressesImported(bytes32[] calldata names, address[] calldata destinations) external view override returns (bool) {
        for (uint i = 0; i < names.length; i++) {
            if (_repository[names[i]] != destinations[i]) {
                return false;
            }
        }
        return true;
    }

    function getAddress(bytes32 name) external view override returns (address) {
        return _repository[name];
    }

    function owner() public view override(IAddressResolver, Ownable) returns (address) {
        return super.owner();
    }

    event AddressImported(bytes32 name, address destination);
}
