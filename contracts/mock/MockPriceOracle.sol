// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPriceOracle is Ownable {

    int price = 0;
    uint private _decimals = 8;

    function setPrice(int _price) external onlyOwner {
        price = _price;
    }

    function latestAnswer() external view returns (int256) {
        return price;
    }

    function decimals() external view returns (uint256) {
        return _decimals;
    }
}