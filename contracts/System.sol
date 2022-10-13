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
import "./BaseSystem.sol";

contract System is BaseSystem{
    using SafeMath for uint;

    constructor(address addrResolver, uint minCRatio_, uint safeCRatio_) {
        minCRatio = minCRatio_;
        safeCRatio = safeCRatio_;
        _addrResolver = IAddressResolver(addrResolver);
    }

    /* -------------------------------------------------------------------------- */
    /*                              Public Functions                              */
    /* -------------------------------------------------------------------------- */

    function deposit(address asset, uint amount) external {
        require(asset != address(0), "System: asset cannot be 0x0");
        require(amount > 0, "System: amount must be greater than 0");
        depositInternal(msg.sender, asset, amount);
    }

    function withdraw(address asset, uint amount) external {
        require(amount > 0, "System: amount must be greater than 0");
        require(asset != address(0), "System: asset cannot be 0x0");
        withdrawInternal(msg.sender, asset, amount);
    }

    function borrow(address asset, uint amount) external {
        require(isIssuancePaused == false, "SYSTEM: Issuance is paused");
        require(amount > 0, "System: amount must be greater than 0");
        require(asset != address(0), "System: asset cannot be 0x0");
        borrowInternal(msg.sender, asset, amount);
    }

    function repay(address asset, uint amount) external {
        require(isIssuancePaused == false, "SYSTEM: Issuance is paused");
        require(amount > 0, "System: amount must be greater than 0");
        require(asset != address(0), "System: asset cannot be 0x0");
        repayInternal(msg.sender, asset, amount);
    }

    function exchange(uint poolIndex, address src, uint srcAmount, address dst) external {
        require(!isExchangePaused, "SYSTEM: Exchange is paused");
        require(srcAmount > 0, "System: amount must be greater than 0");
        require(src != address(0) && dst != address(0), "System: asset cannot be 0x0");
        require(isTradingPool[address(tradingPools[poolIndex])] || poolIndex == 0, "System: pool does not exist");
        exchangeInternal(msg.sender, poolIndex, src, srcAmount, dst);
    }

    function enterPool(uint poolIndex, address asset, uint amount) external {
        require(amount > 0, "System: amount must be greater than 0");
        repayInternal(msg.sender, asset, amount);
        tradingPools[poolIndex].increaseDebt(msg.sender, asset, amount);
        emit PoolEntered(address(tradingPools[poolIndex]), msg.sender, asset, amount);
    }

    function exitPool(uint poolIndex, address asset, uint amount) external {
        require(amount > 0, "System: amount must be greater than 0");
        tradingPools[poolIndex].decreaseDebt(msg.sender, asset, amount);
        borrowInternal(msg.sender, asset, amount);
        emit PoolExited(address(tradingPools[poolIndex]), msg.sender, asset, amount);
    }

    function liquidate(address user) external {
        uint cRatio = collateralRatio(user);
        require(
            cRatio < minCRatio && cRatio > 0,
            "Reserve: Cannot be liquidated, cRation is above MinCRatio"
        );
        ILiquidator(liquidator()).liquidate(msg.sender, user);
    }

    function partialLiquidate(address user, address borrowedAsset, uint borrowedAmount) external {
        uint cRatio = collateralRatio(user);
        require(
            collateralRatio(user) < minCRatio && cRatio > 0,
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
    
    function newCollateralAsset(string memory name, string memory symbol, uint decimals, address asset, address oracle, uint minCollateral) external onlySysAdmin {
        ICollateralManager(cManager()).create(name, symbol, decimals, asset, oracle, minCollateral);
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

    function collateralRatio(address account) public override view returns (uint) {
        uint256 _debt = reservePoolDebt(account).add(tradingPoolDebt(account));
        if (_debt == 0) {
            return 2**256 - 1;
        }
        return totalCollateral(account).mul(1e18).div(_debt);
    }

    function totalCollateral(address account) public view returns (uint) {
        return ICollateralManager(cManager()).totalCollateral(account);
    }

    function reservePoolDebt(address account) public view returns (uint) {
        return IDebtManager(dManager()).totalDebt(account);
    }

    function tradingPoolDebt(address account) public view returns (uint) {
        uint _debt = 0;
        for (uint i = 1; i <= tradingPoolsCount; i++) {
            _debt = _debt.add(tradingPools[i].getBorrowBalanceUSD(account));
        }
        return _debt;
    }
}