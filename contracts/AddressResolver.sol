pragma solidity ^0.8.9;

import "./interfaces/IAddressResolver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AddressResolver is IAddressResolver, Ownable {
    mapping(bytes32 => address) public repository;

    function importAddresses(bytes32[] calldata names, address[] calldata destinations) external onlyOwner {
        require(names.length == destinations.length, "AddressResolver: Input lengths must match");

        for (uint i = 0; i < names.length; i++) {
            bytes32 name = names[i];
            address destination = destinations[i];
            repository[name] = destination;
            emit AddressImported(name, destination);
        }
    }

    function areAddressesImported(bytes32[] calldata names, address[] calldata destinations) external view returns (bool) {
        for (uint i = 0; i < names.length; i++) {
            if (repository[names[i]] != destinations[i]) {
                return false;
            }
        }
        return true;
    }

    function getAddress(bytes32 name) external view returns (address) {
        return repository[name];
    }

    function owner() public view override(IAddressResolver, Ownable) returns (address) {
        return super.owner();
    }

    event AddressImported(bytes32 name, address destination);
}
