// SPDX-License-Identifier: SEE LICENSE IN LICENSE
pragma solidity ^0.8.6;

import "./interfaces/IRoleManager.sol";
import "./interfaces/IAddressResolver.sol";
import "./interfaces/IReserve.sol";
import "./interfaces/ILiquidator.sol";
import "./interfaces/ICollateralManager.sol";
import "./interfaces/IDebtManager.sol";
import "./interfaces/IInterestRate.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "./pool/TradingPool.sol";

contract System {
    using SafeMath for uint;
    bool private isExchangePaused = false;
    bool private isIssuancePaused = false;

    IAddressResolver _addrResolver;
    uint256 public minCRatio;
    uint256 public safeCRatio;

    uint public tradingPoolsCount = 0;
    mapping(uint => IPool) public tradingPools;
    mapping(address => bool) public isTradingPool;

    event NewTradingPool(address pool, uint poolId);
    event NewCollateralAsset(address asset, address priceOracle, uint minCollateral);
    event NewSynthAsset(address asset, address priceOracle, address interestRateModel);

    event NewMinCRatio(uint256 minCRatio);
    event NewSafeCRatio(uint256 minCRatio);

    event PoolEntered(address pool, address account, address asset, uint amount);
    event PoolExited(address pool, address account, address asset, uint amount);
    event Liquidate(address pool, address liquidator, address account, address asset, uint amount);
    event Borrow(address account, address asset, uint amount);
    event Repay(address account, address asset, uint amount);
    event Deposit(address account, address asset, uint amount);
    event Withdraw(address account, address asset, uint amount);
    event Exchange(uint pool, address account, address src, uint srcAmount, address dst);
    
    constructor(address addrResolver, uint minCRatio_, uint safeCRatio_) {
        minCRatio = minCRatio_;
        safeCRatio = safeCRatio_;
        _addrResolver = IAddressResolver(addrResolver);
    }

    /* -------------------------------------------------------------------------- */
    /*                              Public Functions                              */
    /* -------------------------------------------------------------------------- */

    function deposit(address asset, uint amount) external payable {
        IReserve(reserve()).increaseCollateral{value: msg.value}(msg.sender, asset, amount);
        emit Deposit(msg.sender, asset, amount);
    }

    function withdraw(address asset, uint amount) external {
        IReserve(reserve()).decreaseCollateral(msg.sender, asset, amount);
        emit Withdraw(msg.sender, asset, amount);
    }

    function borrow(address asset, uint amount) external {
        require(isIssuancePaused == false, "SYSTEM: Issuance is paused");
        IReserve(reserve()).increaseDebt(msg.sender, asset, amount);
        require(collateralRatio(msg.sender) > safeCRatio, "SYSTEM: cRatio is below safety threshold");
        emit Borrow(msg.sender, asset, amount);
    }

    function repay(address asset, uint amount) external {
        require(isIssuancePaused == false, "SYSTEM: Issuance is paused");
        IReserve(reserve()).decreaseDebt(msg.sender, asset, amount);
        emit Repay(msg.sender, asset, amount);
    }

    function exchange(uint poolIndex, address src, uint srcAmount, address dst) external {
        require(!isExchangePaused, "SYSTEM: Exchange is paused");
        if(poolIndex == 0){
            IReserve(reserve()).exchange(msg.sender, src, srcAmount, dst);
            emit Exchange(poolIndex, msg.sender, src, srcAmount, dst);
        } else {
            tradingPools[poolIndex].exchange(msg.sender, src, srcAmount, dst);
            emit Exchange(poolIndex, msg.sender, src, srcAmount, dst);
        }
    }

    function enterPool(uint poolIndex, address asset, uint amount) external {
        IReserve(reserve()).decreaseDebt(msg.sender, asset, amount);
        tradingPools[poolIndex].increaseDebt(msg.sender, asset, amount);
        emit PoolEntered(address(tradingPools[poolIndex]), msg.sender, asset, amount);
    }

    function exitPool(uint poolIndex, address asset, uint amount) external {
        tradingPools[poolIndex].decreaseDebt(msg.sender, asset, amount);
        IReserve(reserve()).increaseDebt(msg.sender, asset, amount);
        emit PoolExited(address(tradingPools[poolIndex]), msg.sender, asset, amount);
    }

    function liquidate(address user) external {
        require(
            collateralRatio(user) < minCRatio,
            "Reserve: Cannot be liquidated, cRation is above MinCRatio"
        );
        ILiquidator(liquidator()).liquidate(msg.sender, user);
    }

    function partialLiquidate(address user, address borrowedAsset, uint borrowedAmount) external {
        require(
            collateralRatio(user) < minCRatio,
            "Reserve: Cannot be liquidated, cRation is above MinCRatio"
        );
        ILiquidator(liquidator()).partialLiquidate(
            msg.sender,
            user,
            borrowedAsset,
            borrowedAmount
        );
    }

    /* -------------------------------------------------------------------------- */
    /*                               Admin Functions                              */
    /* -------------------------------------------------------------------------- */

    function newTradingPool(string memory name, string memory symbol) external onlySysAdmin {
        TradingPool pool = new TradingPool(name, symbol);
        tradingPoolsCount += 1;
        tradingPools[tradingPoolsCount] = IPool(address(pool));
        isTradingPool[address(pool)] = true;
        emit NewTradingPool(address(pool), tradingPoolsCount);
    }
    
    function newCollateralAsset(string memory name, string memory symbol, address asset, address oracle, uint minCollateral) external onlySysAdmin {
        ICollateralManager(cManager()).create(name, symbol, asset, oracle, minCollateral);
        emit NewCollateralAsset(asset, address(oracle), minCollateral);
    }

    function newSynthAsset(string memory name, string memory symbol, address _oracle, address _interestRateModel) external onlySysAdmin {
        address synth = IDebtManager(dManager()).create(name, symbol, _oracle, _interestRateModel);
        emit NewSynthAsset(synth, address(_oracle), address(_interestRateModel)); 
    }

    function setMinCRatio(uint _minCRatio) external onlySysAdmin {
        minCRatio = _minCRatio;
        emit NewMinCRatio(_minCRatio);
    }

    function setSafeCRatio(uint _safeCRatio) external onlySysAdmin {
        safeCRatio = _safeCRatio;
        emit NewSafeCRatio(_safeCRatio);
    }

    
    /* -------------------------------------------------------------------------- */
    /*                               View Functions                               */
    /* -------------------------------------------------------------------------- */

    function getDebtTracker(address asset) public view returns (address) {
        return IDebtManager(dManager()).assetToDAsset(asset);
    }

    function collateralRatio(address account) public returns (uint) {
        uint256 _debt = reservePoolDebt(account).add(tradingPoolDebt(account));
        if (_debt == 0) {
            return 2**256 - 1;
        }
        return totalCollateral(account).mul(1e18).div(_debt);
    }

    function collateralRatioStored(address account) public view returns (uint) {
        uint256 _debt = reservePoolDebtStored(account).add(tradingPoolDebt(account));
        if (_debt == 0) {
            return 2**256 - 1;
        }
        return totalCollateral(account).mul(1e18).div(_debt);
    }

    function totalCollateral(address account) public view returns (uint) {
        return ICollateralManager(cManager()).totalCollateral(account);
    }

    function reservePoolDebt(address account) public returns (uint) {
        return IDebtManager(dManager()).totalDebt(account);
    }

    function reservePoolDebtStored(address account) public view returns (uint) {
        return IDebtManager(dManager()).totalDebtStored(account);
    }
    
    function tradingPoolDebt(address account) public view returns (uint) {
        uint _debt = 0;
        for (uint i = 1; i <= tradingPoolsCount; i++) {
            _debt = _debt.add(tradingPools[i].getBorrowBalanceUSD(account));
        }
        return _debt;
    }

    function owner() public view returns (address) {
        return _addrResolver.owner();
    }

    function pauseExchange() external onlySysAdmin {
        isExchangePaused = true;
    }

    function resumeExchange() external onlySysAdmin {
        isExchangePaused = false;
    }

    function pauseIssuance() external onlySysAdmin {
        isIssuancePaused = true;
    }

    function resumeIssuance() external onlySysAdmin {
        isIssuancePaused = false;
    }

    function reserve() public view returns (address){
        return _addrResolver.getAddress("RESERVE");
    }
    
    function cManager() public view returns (address){
        return _addrResolver.getAddress("COLLATERAL_MANAGER");
    }
    
    function dManager() public view returns (address){
        return _addrResolver.getAddress("DEBT_MANAGER");
    }

    function liquidator() public view returns (address){
        return _addrResolver.getAddress("LIQUIDATOR");
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Modifiers                                 */
    /* -------------------------------------------------------------------------- */

    modifier onlySysAdmin() {
        require(owner() == msg.sender, "System: Only Admin can call this function");
        _;
    }
}