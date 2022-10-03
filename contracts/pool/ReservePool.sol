// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/ISynthERC20.sol";
import "../interfaces/ISystem.sol";
import "../interfaces/IPriceOracle.sol";

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract ReservePool is ERC20 {
    using SafeMath for uint;

    uint public cAssetsCount = 0;
    mapping(uint => address) public cAssets;
    mapping(address => IPriceOracle) public cAssetsOracle;

    uint public dAssetsCount = 0;
    mapping(uint => address) public dAssets;

    mapping(address => mapping(address => uint)) public globalDebtPool;
    mapping(address => mapping(address => uint)) public globalCollateralPool;
    mapping(address => uint) public totalCollateral;

    uint minCRatio = 1.5e18;

    ISystem system;

    constructor(ISystem _system) ERC20("Synthex Pool Debt", "SPD") {
        system = _system;
    }

    function setMinCRatio(uint _minCRatio) external {
        require(msg.sender == system.owner(), "ReservePool: Not owner can set min c-ratio");
        minCRatio = _minCRatio;
    }

    function addCollateralAsset(address asset, address oracle) external {
        require(msg.sender == system.owner(), "ReservePool: Not owner can add collateral");
        cAssets[cAssetsCount] = asset;
        cAssetsOracle[asset] = IPriceOracle(oracle);
        cAssetsCount += 1;
    }

    function addDebtAsset(address asset) external {
        require(msg.sender == system.owner(), "ReservePool: Not owner can add debt");
        dAssets[dAssetsCount] = asset;
        dAssetsCount += 1;
    }

    function increaseCollateral(address asset, uint amount) external payable {
        if(msg.value > 0){
            globalCollateralPool[msg.sender][address(0)] += msg.value;
            totalCollateral[address(0)] += msg.value;
        }
        if(asset != address(0)){
            globalCollateralPool[msg.sender][asset] += amount;
            totalCollateral[asset] += amount;
            IERC20(asset).transferFrom(msg.sender, address(this), amount);
        }
    }

    function decreaseCollateral(address asset, uint amount) external {
        globalCollateralPool[msg.sender][asset] -= amount;
        totalCollateral[asset] -= amount;
    }

    function issue(ISynthERC20 asset, uint amount) external {
        (uint price, uint priceDecimals) = asset.debt().get_price();
        globalDebtPool[msg.sender][address(asset)] += amount.mul(price).div(10**priceDecimals);
        asset.issue(msg.sender, amount);
        require(getCRatio(msg.sender) > minCRatio, "ReservePool: Not enough collateral");
    }

    function burn(ISynthERC20 asset, uint amount) external {
        (uint price, uint priceDecimals) = asset.debt().get_price();
        globalDebtPool[msg.sender][address(asset)] -= amount.mul(price).div(10**priceDecimals);
        asset.burn(msg.sender, amount);
    }

    function getCollateralPrice(address asset) public view returns(uint, uint){
        return (uint(cAssetsOracle[asset].latestAnswer()), cAssetsOracle[asset].decimals());
    }

    function getTotalCollateral(address account) public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < cAssetsCount; i++){
            (uint price, uint priceDecimals) = getCollateralPrice(cAssets[i]);
            total += globalCollateralPool[account][cAssets[i]].mul(price).div(10**priceDecimals);
        }
        return total;
    }

    function getTotalDebt(address account) public view returns(uint){
        uint total = 0;
        for(uint i = 0; i < dAssetsCount; i++){
            (uint price, uint priceDecimals) = ISynthERC20(dAssets[i]).debt().get_price();
            total += globalDebtPool[account][dAssets[i]].mul(price).div(10**priceDecimals);
        }
        return total;
    }

    function getCRatio(address account) public view returns(uint){
        uint _totalCollateral = getTotalCollateral(account);
        uint totalDebt = getTotalDebt(account);
        return _totalCollateral.mul(1e18).div(totalDebt);
    }
}