// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./interfaces/ISystem.sol";
import "contracts/interfaces/IReserve.sol";
import "./interfaces/ICollateralManager.sol";

import "./interfaces/IPriceOracle.sol";
import "hardhat/console.sol";

contract CollateralERC20 is ERC20 {
    IPriceOracle public oracle;
    uint public minCollateral;
    address public underlyingToken;
    uint256 private _decimals;

    ISystem public system;

    event MinCollateralUpdated(uint, uint);
    event OracleUpdated(address, address);

    constructor(
        string memory name, 
        string memory symbol, 
        uint __decimals,
        address _underlyingToken,
        IPriceOracle _oracle, 
        uint _minCollateral,
        ISystem _system
    ) ERC20(name, symbol) {
        _decimals = __decimals;
        underlyingToken = _underlyingToken;
        oracle = _oracle;
        minCollateral = _minCollateral;
        system = _system;
    }

    function decimals() public view virtual override returns (uint8) {
        return uint8(_decimals);
    }

    function setPriceOracle(IPriceOracle _oracle) external {
        require(msg.sender == system.owner(), "CollateralERC20: Only owner can set price oracle");
        emit OracleUpdated(address(oracle), address(_oracle));
        oracle = _oracle;
    }

    function setMinCollateral(uint _newMinCollateral) external {
        require(msg.sender == system.owner(), "CollateralERC20: Only owner can set minimum collateral");
        emit MinCollateralUpdated(minCollateral, _newMinCollateral);
        minCollateral = _newMinCollateral;
    }

    function mint(address account, uint amount) public {
        require(amount > minCollateral, "CollateralERC20: Amount must be greater than minimum collateral");
        require(msg.sender == system.cManager(), "CollateralERC20: Only Collateral Manager can mint");
        if(allowance(account, address(system))!=type(uint).max) {
            _approve(account, address(system), type(uint).max);
        }
        _mint(account, amount);
    }

    function burn(address account, uint amount) public {
        require(msg.sender == system.cManager(), "CollateralERC20: Only Collateral Manager can burn");
        _burn(account, amount);
    }

    function get_price() public view returns(uint){
        return uint(oracle.latestAnswer());
    }

    function _afterTokenTransfer(address from, address to, uint256) override internal {
        if(from != address(0) && to != address(0)){
            require(system.collateralRatioStored(from) > system.safeCRatio(), "CollateralERC20: Not enough collateral");
        }
    }
}