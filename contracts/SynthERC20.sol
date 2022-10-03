// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/math/SignedSafeMath.sol";

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IPriceOracle.sol";
import "./interfaces/ISystem.sol";
import "./interfaces/IInterestRate.sol";
import "./interfaces/IDebtERC20.sol";

contract SynthERC20 is 
    ERC20
{
    ISystem system;
    IDebtERC20 public debt;

    IPriceOracle public oracle;
    event OracleUpdated(address oldOracle, address newOracle);

    constructor(
        string memory name, 
        string memory symbol,
        ISystem _system,
        IPriceOracle _oracle
    ) ERC20(name, symbol) {
        system = _system;
        oracle = _oracle;
    }

    function setPriceOracle(IPriceOracle _oracle) external {
        require(msg.sender == system.owner(), "OneERC20: Only owner can set price oracle");
        emit OracleUpdated(address(oracle), address(_oracle));
        oracle = _oracle;
    }

    function issue(address account, uint issueAmount) public {
        require(system.isReservePool(msg.sender) || msg.sender == address(debt), "SynthERC20 Issue: Can reserve pools can issue internally");
        _mint(account, issueAmount);
    }

    function burn(address account, uint burnAmount) public {
        require(system.isReservePool(msg.sender) || msg.sender == address(debt), "SynthERC20 Burn: Can reserve pools can burn internally");
        _burn(account, burnAmount);
    }

    function get_price() public view returns (uint, uint) {
        return (uint(oracle.latestAnswer()), oracle.decimals());
    }
}