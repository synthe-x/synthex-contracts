import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import main from "../scripts/index";
import BigNumber from 'ethers';

const ETHUSD = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e";
const BTCUSD = "0xA39434A63A52E749F02807ae27335515BA4b07F7";
const LINKUSD = "0xb4c4a493AB6356497713A78FFA6c60FB53517c63";
const FORTHUSD = "0x7A65Cf6C2ACE993f09231EC1Ea7363fb29C13f2F";

describe("ETH Collateral, 3 Debt Assets, Single User", function () {
  let reserve: Contract, cManager: Contract, dManager: Contract, 
  usdOracle: Contract, ethOracle: Contract, btcOracle: Contract, 
  helper: Contract, fixedIntRate: Contract;
  let usdpool: Contract, dusdpool: Contract, 
  btcpool: Contract, dbtcpool: Contract, 
  ethpool: Contract, dethpool: Contract;
  let PriceOracle, cPool: any, dPool: any, sPool: any;
  let usdPrice = 0, btcPrice = 0, ethPrice = 0;
  let accounts: SignerWithAddress[];
  
  const ONE_ETH = ethers.utils.parseEther("1");

  before(async() => {
    accounts = await ethers.getSigners();
    PriceOracle = await ethers.getContractFactory("MockPriceOracle");
    usdOracle = await PriceOracle.deploy();
    await usdOracle.setPrice("100000000")

    btcOracle = await PriceOracle.deploy();
    await btcOracle.setPrice("2000000000000")

    ethOracle = await PriceOracle.deploy();
    await ethOracle.setPrice("100000000000")

    const deployments = await main(false, true)
    reserve = deployments.reserve
    cManager = deployments.cManager
    dManager = deployments.dManager
    helper = deployments.helper
    fixedIntRate = deployments.fixedIntRate
    
    sPool = await ethers.getContractFactory("SynthERC20");
    dPool = await ethers.getContractFactory("DebtTracker");
    cPool = await ethers.getContractFactory("CollateralERC20");
  })
  
  it("should add eth collateral", async function () {
    await cManager.create("Synthex Collateralized Ethereum", "sxcETH", ethers.constants.AddressZero, ethOracle.address, ONE_ETH);
    let cxeth = await cManager.cAssets(0);
    cxeth = cPool.attach(cxeth);

    let priceArray = await cxeth.get_price();
    ethPrice = priceArray[0].div(ethers.BigNumber.from("10").pow(priceArray[1])).toNumber();
    expect(ethPrice).to.be.greaterThan(0);
  })
  
  it("should create usd pool", async function () {
    await dManager.create("One USD", "oneUSD", usdOracle.address, fixedIntRate.address);
    let pool = await dManager.dAssets(0);
    expect(pool).to.not.equal(ethers.constants.AddressZero);
    dusdpool = dPool.attach(pool);
    usdpool = sPool.attach(await dusdpool.synth());
    let priceArray = await usdpool.get_price();
    usdPrice = priceArray[0].div(ethers.BigNumber.from("10").pow(priceArray[1])).toNumber();
    expect(usdPrice).to.equal(1);
  });

  it("should create btc and eth pool", async function () {
    await dManager.create("One BTC", "oneBTC", btcOracle.address, fixedIntRate.address);
    let pool = await dManager.dAssets(1);
    expect(pool).to.not.equal(ethers.constants.AddressZero);
    dbtcpool = dPool.attach(pool);
    btcpool = sPool.attach(await dbtcpool.synth());
    let priceArray = await btcpool.get_price();
    btcPrice = priceArray[0].div(ethers.BigNumber.from("10").pow(priceArray[1])).toNumber();
    expect(btcPrice).to.be.greaterThan(0);

    await dManager.create("One ETH", "oneETH", ethOracle.address, fixedIntRate.address);
    pool = await dManager.dAssets(2);
    expect(pool).to.not.equal(ethers.constants.AddressZero);
    dethpool = dPool.attach(pool);
    ethpool = sPool.attach(await dethpool.synth());
    
    priceArray = await ethpool.get_price();
    ethPrice = priceArray[0].div(ethers.BigNumber.from("10").pow(priceArray[1])).toNumber();
    expect(ethPrice).to.be.greaterThan(0);
  });

  it("should deposit 1.1 ETH", async function () {
    let depositAmount = ethers.utils.parseEther("1.1");
    await reserve.connect(accounts[0]).increaseCollateral(ethers.constants.AddressZero, 0, {value: depositAmount});
    expect(await cManager.totalCollateral(accounts[0].address)).to.be.equal(depositAmount.mul(ethPrice));
    expect(await cManager.collateral(accounts[0].address, ethers.constants.AddressZero)).to.be.equal(depositAmount);
  })

  it("should withdraw 0.1 ETH", async function () {
    let withdrawAmount = ethers.utils.parseEther("0.1");
    await reserve.connect(accounts[0]).decreaseCollateral(ethers.constants.AddressZero, withdrawAmount);
    let afterBalance = ethers.utils.parseEther("1")
    expect(await cManager.totalCollateral(accounts[0].address)).to.be.equal(afterBalance.mul(ethPrice));
    expect(await cManager.collateral(accounts[0].address, ethers.constants.AddressZero)).to.be.equal(afterBalance);
  })

  it("should borrow 100 sUSD", async function () {
    let borrowAmount = ethers.utils.parseEther("100");

    await reserve.connect(accounts[0]).borrow(dusdpool.address, borrowAmount);
    expect(await dManager.callStatic.totalDebt(accounts[0].address)).to.be.equal(borrowAmount.mul(usdPrice));
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(borrowAmount);
    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(borrowAmount);
    expect(await usdpool.totalSupply()).to.be.equal(borrowAmount);
    expect(await reserve.callStatic.collateralRatio(accounts[0].address)).to.be.greaterThan(1);
  })

  it("should exchange 100 sUSD to 0.1 sETH", async function () {
    let sUSDAmount = ethers.utils.parseEther("100");
    let sETHAmount = ethers.utils.parseEther("0.1");

    await reserve.connect(accounts[0]).exchange(0, dusdpool.address, sUSDAmount, dethpool.address);

    expect(await dManager.callStatic.totalDebt(accounts[0].address)).to.be.equal(sETHAmount.mul(ethPrice));
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(0);
    expect(await dethpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(sETHAmount);

    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(0);
    expect(await ethpool.balanceOf(accounts[0].address)).to.be.equal(sETHAmount);

    expect(await usdpool.totalSupply()).to.be.equal(0);
    expect(await ethpool.totalSupply()).to.be.equal(sETHAmount);
  })

  it("should exchange 0.1 sETH back to 100 sUSD", async function () {
    let sUSDAmount = ethers.utils.parseEther("100");
    let sETHAmount = ethers.utils.parseEther("0.1");

    await reserve.connect(accounts[0]).exchange(0, dethpool.address, sETHAmount, dusdpool.address);

    expect(await dManager.callStatic.totalDebt(accounts[0].address)).to.be.equal(sUSDAmount.mul(usdPrice));
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(sUSDAmount);
    expect(await dethpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(0);

    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(sUSDAmount);
    expect(await ethpool.balanceOf(accounts[0].address)).to.be.equal(0);

    expect(await usdpool.totalSupply()).to.be.equal(sUSDAmount);
    expect(await ethpool.totalSupply()).to.be.equal(0);
  })

  it("repay 100 sUSD", async function () {
    let borrowedAmount = ethers.utils.parseEther("100");

    await reserve.connect(accounts[0]).repay(dusdpool.address, borrowedAmount);
    expect(await dManager.callStatic.totalDebt(accounts[0].address)).to.be.equal(0);
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(0);
    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(0);
    // expect(await usdpool.totalSupply()).to.be.equal(borrowAmount);
    // expect(await reserve.callStatic.collateralRatio(accounts[0].address)).to.be.greaterThan(1);
  })
});
