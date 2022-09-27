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


import "hardhat/console.sol";

contract OneERC20 is 
    ERC20
{
    using SafeMath for uint256;
    using SignedSafeMath for int256;
    IERC20 public token;

    ISystem system;
    
    event OracleUpdated(address oldOracle, address newOracle);

    uint deposits;
    uint borrowed;
    uint reserve;
    IPriceOracle oracle;

    // deposit balance in token units
    mapping(address => uint) public depositBalances;
    // borrow balance in oneUSD
    mapping(address => uint) public borrowBalances;

    uint public PERCENT;
    uint public FEE_TO_PERCENT;

    constructor(string memory name, string memory symbol, ISystem _system) ERC20(name, symbol) {
        system = _system;
    }

    function borrowLimit(address account) public view returns (int) {
        return int(depositBalances[account])
        .mul(oracle.latestAnswer())
        .div(1e8)
        .sub(int(borrowBalances[account]));
        // .mul(int(PERCENT - FEE_TO_PERCENT)).div(int(PERCENT));
    }

    function initialize(address _oracle) public {
        oracle = IPriceOracle(_oracle);

        // PERCENT = 10_000;
        // FEE_TO_PERCENT = _reserve;
        // require(PERCENT > FEE_TO_PERCENT, "Fee should be greater than fee to percent");
    }
    
    function issue(address account, uint amount) public {
        require(msg.sender == system.dManager() || msg.sender == system.exchanger(), "OneERC20 Issue: Can only be called internally");
        _mint(account, amount);
    }

    function burn(address account, uint amount) public {
        require(msg.sender == system.dManager() || msg.sender == system.exchanger(), "OneERC20 Issue: Can only be called internally");
        _burn(account, amount);
    }

    function get_price() public view returns (uint) {
        return uint(oracle.latestAnswer());
    }

    function priceDecimals() public view returns (uint) {
        return oracle.decimals();
    }
}