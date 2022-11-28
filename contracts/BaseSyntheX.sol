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

abstract contract BaseSyntheX {
    using SafeMath for uint;
    bool public isExchangePaused = false;
    bool public isIssuancePaused = false;

    IAddressResolver _addrResolver;
    uint256 public minCRatio;
    uint256 public safeCRatio;

    uint public tradingPoolsCount = 0;
    mapping(uint => IPool) public tradingPools;
    mapping(address => bool) public isTradingPool;

    event IssuancePaused();
    event TradingPaused();
    event IssuanceResumed();
    event TradingResumed();
    event SynthEnabledInTradingPool(address tradingPool, address[] synths);
    event SynthDisabledInTradingPool(address tradingPool, address[] synths);
    event CollateralPaused(address asset);
    event CollateralResumed(address asset);
    event SynthPaused(address asset);
    event SynthResumed(address asset);

    event NewTradingPool(address pool, uint poolId);
    event NewCollateralAsset(address asset, address priceOracle, uint minCollateral);
    event NewSynthAsset(address asset, address priceOracle, address interestRateModel);

    event NewMinCRatio(uint256 minCRatio);
    event NewSafeCRatio(uint256 safeCRatio);

    event PoolEntered(address pool, address account, address asset, uint amount);
    event PoolExited(address pool, address account, address asset, uint amount);
    event Liquidate(address pool, address liquidator, address account, address asset, uint amount);
    event Borrow(address account, address asset, uint amount);
    event Repay(address account, address asset, uint amount);
    event Deposit(address account, address asset, uint amount);
    event Withdraw(address account, address asset, uint amount);
    event Exchange(uint pool, address account, address src, uint srcAmount, address dst);

    /* -------------------------------------------------------------------------- */
    /*                              Public Functions                              */
    /* -------------------------------------------------------------------------- */

    function depositInternal(address user, address asset, uint amount) internal {
        IERC20(asset).transferFrom(user, reserve(), amount);
        IReserve(reserve()).increaseCollateral(user, asset, amount);
        emit Deposit(user, asset, amount);
    }

    function withdrawInternal(address user, address asset, uint amount) internal {
        IReserve(reserve()).decreaseCollateral(user, asset, amount);
        emit Withdraw(user, asset, amount);
    }

    function borrowInternal(address user, address asset, uint amount) internal {
        IReserve(reserve()).increaseDebt(user, asset, amount);
        require(collateralRatio(user) > safeCRatio, "SYSTEM: cRatio is below safety threshold");
        emit Borrow(user, asset, amount);
    }

    function repayInternal(address user, address asset, uint amount) internal {
        IReserve(reserve()).decreaseDebt(user, asset, amount);
        emit Repay(user, asset, amount);
    }

    function exchangeInternal(address user, uint poolIndex, address src, uint srcAmount, address dst) internal {
        IPool pool = tradingPools[poolIndex];
        if(poolIndex == 0){
            pool = IPool(reserve());
        }
        pool.exchange(user, src, srcAmount, dst);
        emit Exchange(poolIndex, user, src, srcAmount, dst);
    }

    function executeLimitOrderInternal(address maker, address taker, address src, address dst, uint srcAmount) public {
        // calculate amount of dst tokens to send
        uint256 dstAmount = srcAmount * ISynthERC20(src).get_price() / ISynthERC20(dst).get_price();
        // transfer tokens
        IERC20(dst).transferFrom(taker, maker, dstAmount);
        IERC20(src).transferFrom(maker, taker, srcAmount);
    }

    /* -------------------------------------------------------------------------- */
    /*                               View Functions                               */
    /* -------------------------------------------------------------------------- */
    function collateralRatio(address) virtual public view returns (uint256);

    function owner() public view returns (address) {
        return _addrResolver.owner();
    }

    function pauseExchange() external onlySysAdmin {
        isExchangePaused = true;
        emit TradingPaused();
    }

    function resumeExchange() external onlySysAdmin {
        isExchangePaused = false;
        emit TradingResumed();
    }

    function pauseIssuance() external onlySysAdmin {
        isIssuancePaused = true;
        emit IssuancePaused();
    }

    function resumeIssuance() external onlySysAdmin {
        isIssuancePaused = false;
        emit IssuanceResumed();
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

    function limitOrder() public view returns (address){
        return _addrResolver.getAddress("LIMIT_ORDER");
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Modifiers                                 */
    /* -------------------------------------------------------------------------- */

    modifier onlySysAdmin() {
        require(owner() == msg.sender, "System: Only Admin can call this function");
        _;
    }
}