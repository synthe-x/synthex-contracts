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
  system: Contract, helper: Contract, weth: Contract;
  let usdpool: Contract, dusdpool: Contract, 
  btcpool: Contract, dbtcpool: Contract, 
  ethpool: Contract, dethpool: Contract;
  let PriceOracle;
  let usdPrice = 0, btcPrice = 0, ethPrice = 0;
  let accounts: SignerWithAddress[];
  
  before(async() => {
    accounts = await ethers.getSigners();
    PriceOracle = await ethers.getContractFactory("MockPriceOracle");
    usdOracle = await PriceOracle.deploy();
    usdPrice = 1
    await usdOracle.setPrice(usdPrice*100000000)

    btcOracle = await PriceOracle.deploy();
    btcPrice = 20000
    await btcOracle.setPrice(btcPrice*100000000)

    ethOracle = await PriceOracle.deploy();
    ethPrice = 1000
    await ethOracle.setPrice(ethPrice*100000000)

    const deployments = await main(false)
    reserve = deployments.reserve
    cManager = deployments.cManager
    dManager = deployments.dManager
    helper = deployments.helper
    system = deployments.sys
    weth = deployments.weth
    
    let scxeth = deployments.ceth
    await scxeth.setPriceOracle(ethOracle.address)
    dusdpool = deployments.usddebt
    usdpool = deployments.usdpool
    await usdpool.setPriceOracle(usdOracle.address)
    dbtcpool = deployments.btcddebt
    btcpool = deployments.btcpool
    await btcpool.setPriceOracle(btcOracle.address)
    dethpool = deployments.ethdebt
    ethpool = deployments.ethpool
    await ethpool.setPriceOracle(ethOracle.address)
  })

  it("should deposit 1.1 ETH", async function () {
    await weth.deposit();
    let depositAmount = ethers.utils.parseEther("1.1");
    await weth.connect(accounts[0]).approve(system.address, depositAmount);
    await system.connect(accounts[0]).deposit(weth.address, depositAmount);
    expect(await system.totalCollateral(accounts[0].address)).to.be.equal(depositAmount.mul(ethPrice));
    expect(await cManager.collateral(accounts[0].address, weth.address)).to.be.equal(depositAmount);
  })

  it("should withdraw 0.1 ETH", async function () {
    let withdrawAmount = ethers.utils.parseEther("0.1");
    await system.connect(accounts[0]).withdraw(weth.address, withdrawAmount);
    let afterBalance = ethers.utils.parseEther("1");
    expect(await system.totalCollateral(accounts[0].address)).to.be.equal(afterBalance.mul(ethPrice));
    expect(await cManager.collateral(accounts[0].address, weth.address)).to.be.equal(afterBalance);
  })

  it("should borrow 100 sUSD", async function () {
    let borrowAmount = ethers.utils.parseEther("100");

    await system.connect(accounts[0]).borrow(usdpool.address, borrowAmount);
    expect(await dManager.totalDebt(accounts[0].address)).to.be.equal(borrowAmount.mul(usdPrice));
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(borrowAmount);
    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(borrowAmount);
    expect(await usdpool.totalSupply()).to.be.equal(borrowAmount);
    expect(await system.callStatic.collateralRatio(accounts[0].address)).to.be.greaterThan(1);
  })

  it("should exchange 100 sUSD to 0.1 sETH", async function () {
    let sUSDAmount = ethers.utils.parseEther("100");
    let sETHAmount = ethers.utils.parseEther("0.1");

    await system.connect(accounts[0]).exchange(0, usdpool.address, sUSDAmount, ethpool.address);

    expect(await dManager.totalDebt(accounts[0].address)).to.be.greaterThanOrEqual(sETHAmount.mul(ethPrice));
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.closeTo(0, 2197955306599*2); // plus interest
    expect(await dethpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.equal(sETHAmount);

    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(0);
    expect(await ethpool.balanceOf(accounts[0].address)).to.be.equal(sETHAmount);

    expect(await usdpool.totalSupply()).to.be.equal(0);
    expect(await ethpool.totalSupply()).to.be.equal(sETHAmount);
  })

  it("should exchange 0.1 sETH back to 100 sUSD", async function () {
    let sUSDAmount = ethers.utils.parseEther("100");
    let sETHAmount = ethers.utils.parseEther("0.1");

    await system.connect(accounts[0]).exchange(0, ethpool.address, sETHAmount, usdpool.address);

    expect(await dManager.callStatic.totalDebt(accounts[0].address)).to.be.greaterThanOrEqual(sUSDAmount.mul(usdPrice));
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.closeTo(sUSDAmount, 2197955306599*2); // plus interest
    expect(await dethpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.closeTo(0, 2197955306599*2); // plus interest

    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(sUSDAmount);
    expect(await ethpool.balanceOf(accounts[0].address)).to.be.equal(0);

    expect(await usdpool.totalSupply()).to.be.equal(sUSDAmount);
    expect(await ethpool.totalSupply()).to.be.equal(0);
  })

  it("repay 100 sUSD", async function () {
    let borrowedAmount = ethers.utils.parseEther("100");

    await system.connect(accounts[0]).repay(usdpool.address, borrowedAmount);
    expect(await dManager.callStatic.totalDebt(accounts[0].address)).to.be.closeTo(0, 2197955306599*4); // plus interest
    expect(await dusdpool.callStatic.getBorrowBalance(accounts[0].address)).to.be.closeTo(0, 2197955306599*4); // plus interest
    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(0);
    expect(await usdpool.totalSupply()).to.be.equal(0);
    expect(await system.callStatic.collateralRatio(accounts[0].address)).to.be.greaterThan(1);
  })
});
