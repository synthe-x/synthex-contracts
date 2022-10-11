// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPriceOracle is Ownable {

    int price = 0;

    function setPrice(int _price) external onlyOwner {
        price = _price;
    }

    function latestAnswer() external view returns (int256) {
        return price;
    }
}