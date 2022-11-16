// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import "@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./interfaces/ISynthERC20.sol";

import "./interfaces/ISystem.sol";

contract LimitOrder is EIP712 {

    struct Order {
        address maker;
        address src;
        address dst;
        uint256 srcAmount;
    }

    mapping(bytes32 => uint) public orderFills;

    ISystem system;

    constructor(address _system) EIP712("SyntheXLimitOrderDEX", "1") {
        system = ISystem(_system);
    }

    function executeOrder(address maker, address src, address dst, uint256 srcAmount, uint256 fillAmount, bytes memory signature) public {
        require(msg.sender == address(system), "Only System can execute orders");
        // check signature
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            keccak256("Order(address maker,address src,address dst,uint256 srcAmount)"),
            maker,
            src,
            dst,
            srcAmount
        )));
        // verify signature
        require(SignatureChecker.isValidSignatureNow(maker, digest, signature), "Invalid signature");
        // check fill amount
        orderFills[digest] += fillAmount;
        require(orderFills[digest] <= srcAmount, "Order fill amount exceeds order amount");
    }
}