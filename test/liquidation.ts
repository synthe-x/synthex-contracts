import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import main from "../scripts/index";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const ETHUSD = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e";
const BTCUSD = "0xA39434A63A52E749F02807ae27335515BA4b07F7";
const LINKUSD = "0xb4c4a493AB6356497713A78FFA6c60FB53517c63";
const FORTHUSD = "0x7A65Cf6C2ACE993f09231EC1Ea7363fb29C13f2F";

describe("Checking Liquidations", function () {
  let reserve: Contract, cManager: Contract, dManager: Contract, 
  usdOracle: Contract, ethOracle: Contract, 
  helper: Contract, fixedIntRate: Contract, usdpool: any

  let PriceOracle, Pool: any;
  let usdPrice = 0, btcPrice = 0, ethPrice = 0;
  let accounts: SignerWithAddress[];

  before(async() => {
    accounts = await ethers.getSigners();
    PriceOracle = await ethers.getContractFactory("MockPriceOracle");
    usdOracle = await PriceOracle.deploy();
    await usdOracle.setPrice("100000000")

    ethOracle = await PriceOracle.deploy();
    await ethOracle.setPrice("100000000000")

    const deployments = await main(false)
    reserve = deployments.reserve
    cManager = deployments.cManager
    dManager = deployments.dManager
    helper = deployments.helper
    fixedIntRate = deployments.fixedIntRate
    
    Pool = await ethers.getContractFactory("SynthERC20");
  })
  
  it("should add eth collateral", async function () {
    await cManager.addCollateralAsset(ethers.constants.AddressZero, ethOracle.address);
    let priceArray = await cManager.get_price(ethers.constants.AddressZero);
    ethPrice = priceArray[0].div(ethers.BigNumber.from("10").pow(priceArray[1])).toNumber();
    expect(ethPrice).to.be.greaterThan(0);
  })
  
  it("should create usd pool", async function () {
    await dManager.create("One USD", "oneUSD");
    let pool = await dManager.dAssets(0);
    expect(pool).to.not.equal(ethers.constants.AddressZero);
    usdpool = Pool.attach(pool);
    await usdpool.setPriceOracle(usdOracle.address);
    await usdpool.setInterestRate(fixedIntRate.address);
    usdPrice = await usdpool.get_price();

    let priceArray = await usdpool.get_price();
    usdPrice = priceArray[0].div(ethers.BigNumber.from("10").pow(priceArray[1])).toNumber();

    expect(usdPrice).to.equal(1);
  });

  it("should set fixed interest rate", async function () {
    let rate = ethers.utils.parseUnits("0.0000000003171", 36)
    await fixedIntRate.setInterestRate(rate, "36");
    let setRate = await fixedIntRate.getInterestRate("0")
    expect(setRate[0]).to.equal(rate);
  })

  it("should deposit 1 ETH", async function () {
    let depositAmount = ethers.utils.parseEther("1");
    await reserve.connect(accounts[0]).increaseCollateral(ethers.constants.AddressZero, 0, {value: depositAmount});
    expect(await cManager.totalCollateral(accounts[0].address)).to.be.equal(depositAmount.mul(ethPrice));
    expect(await cManager.collateral(accounts[0].address, ethers.constants.AddressZero)).to.be.equal(depositAmount);
  })

  it("should borrow 100 sUSD", async function () {
    let borrowAmount = ethers.utils.parseEther("100");

    await reserve.connect(accounts[0]).borrow(usdpool.address, borrowAmount);
    expect(await dManager.callStatic.totalDebt(accounts[0].address)).to.be.equal(borrowAmount.mul(usdPrice));
    expect(await usdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(borrowAmount);
    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(borrowAmount);
    expect(await usdpool.totalSupply()).to.be.equal(borrowAmount);
    expect(await reserve.callStatic.collateralRatio(accounts[0].address)).to.be.greaterThan(ethers.utils.parseEther("1.3"));
  })

  it("should allow liquidation if ETH drops by 87%", async function () {
    await ethOracle.setPrice("12000000000")
    expect(await reserve.callStatic.collateralRatio(accounts[0].address)).to.be.lessThan(ethers.utils.parseEther("1.3"));
  })

  it("user 2 prepares to liquidate user 1", async function () {
    // user 1 issues 100 sUSD against 2 ETH
    let depositAmount = ethers.utils.parseEther("2");
    await reserve.connect(accounts[1]).increaseCollateral(ethers.constants.AddressZero, 0, {value: depositAmount});
    let borrowAmount = ethers.utils.parseEther("101");
    await reserve.connect(accounts[1]).borrow(usdpool.address, borrowAmount);
    expect(await usdpool.balanceOf(accounts[1].address)).to.be.equal(borrowAmount);
  })

  it("partially liquidate 10 USD", async function () {
    let liquidationAmount = ethers.utils.parseEther("10");
    let ethBalanceBefore = await ethers.provider.getBalance(accounts[0].address);
    await reserve.connect(accounts[1]).partialLiquidate(accounts[0].address, usdpool.address, liquidationAmount);
    let ethBalanceAfter = await ethers.provider.getBalance(accounts[0].address);
    expect(parseFloat(ethers.utils.formatEther(ethBalanceAfter.sub(ethBalanceBefore)))).to.be.closeTo(0.1, 0.00001);
  })

  it("liquidate", async function () {
    let ethBalanceBefore = await ethers.provider.getBalance(accounts[0].address);
    // await reserve.connect(accounts[1]).liquidate(accounts[0].address);
    await reserve.connect(accounts[1]).partialLiquidate(accounts[0].address, usdpool.address, ethers.utils.parseEther("90"));
    let ethBalanceAfter = await ethers.provider.getBalance(accounts[0].address);
    expect(parseFloat(ethers.utils.formatEther(ethBalanceAfter.sub(ethBalanceBefore)))).to.be.closeTo(0.9, 0.00001);
  })
});
