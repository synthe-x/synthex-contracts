import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import main from "../scripts/index";

const ETHUSD = "0xD4a33860578De61DBAbDc8BFdb98FD742fA7028e";
const BTCUSD = "0xA39434A63A52E749F02807ae27335515BA4b07F7";
const LINKUSD = "0xb4c4a493AB6356497713A78FFA6c60FB53517c63";
const FORTHUSD = "0x7A65Cf6C2ACE993f09231EC1Ea7363fb29C13f2F";

describe("Test", function () {
  let reserve: Contract, cManager: Contract, dManager: Contract, 
  usdOracle: Contract, ethOracle: Contract, btcOracle: Contract, 
  token0: Contract, token1: Contract;
  let usdpool: any, btcpool: Contract, ethpool: Contract, linkpool: Contract, forthpool: Contract;
  let PriceOracle, Pool: any;
  let usdPrice = 0, btcPrice = 0, ethPrice = 0;
  let accounts: SignerWithAddress[];

  before(async() => {
    accounts = await ethers.getSigners();
    PriceOracle = await ethers.getContractFactory("MockPriceOracle");
    usdOracle = await PriceOracle.deploy();
    await usdOracle.setPrice("100000000")

    btcOracle = await PriceOracle.deploy();
    await btcOracle.setPrice("2000000000000")

    ethOracle = await PriceOracle.deploy();
    await ethOracle.setPrice("100000000000")

    const deployments = await main()
    reserve = deployments.reserve
    cManager = deployments.cManager
    dManager = deployments.dManager
    
    Pool = await ethers.getContractFactory("OneERC20");
  })
  
  it("should add eth collateral", async function () {
    await cManager.addCollateralAsset(ethers.constants.AddressZero, ethOracle.address);
    ethPrice = await cManager.getCollateralPrice(ethers.constants.AddressZero);
    expect(ethPrice).to.be.greaterThan(0);
  })
  
  it("should create usd pool", async function () {
    await dManager.create("One USD", "oneUSD");
    let pool = await dManager.dAssets(0);
    expect(pool).to.not.equal(ethers.constants.AddressZero);
    usdpool = Pool.attach(pool);
    await usdpool.initialize(usdOracle.address);
    usdPrice = await usdpool.get_price();

    expect(usdPrice).to.equal(100000000);
  });

  it("should create btc and eth pool", async function () {
    await dManager.create("One BTC", "oneBTC");
    let pool = await dManager.dAssets(1);
    expect(pool).to.not.equal(ethers.constants.AddressZero);
    btcpool = Pool.attach(pool);
    await btcpool.initialize(btcOracle.address);
    btcPrice = await btcpool.get_price();
    
    expect(btcPrice).to.be.greaterThan(0);

    await dManager.create("One ETH", "oneETH");
    pool = await dManager.dAssets(2);
    expect(pool).to.not.equal(ethers.constants.AddressZero);
    ethpool = Pool.attach(pool);
    await ethpool.initialize(ethOracle.address);
    ethPrice = await ethpool.get_price();
    
    expect(ethPrice).to.be.greaterThan(0);
  });

  it("should deposit 1.1 ETH", async function () {
    let depositAmount = ethers.utils.parseEther("1.1");
    await reserve.connect(accounts[0]).increaseCollateral(ethers.constants.AddressZero, 0, {value: depositAmount});
    expect(await cManager.totalCollateral(accounts[0].address)).to.be.equal(depositAmount.mul(ethPrice).div(1e8));
    expect(await cManager.collateral(accounts[0].address, ethers.constants.AddressZero)).to.be.equal(depositAmount);
  })

  it("should withdraw 0.1 ETH", async function () {
    let withdrawAmount = ethers.utils.parseEther("0.1");
    await reserve.connect(accounts[0]).decreaseCollateral(ethers.constants.AddressZero, withdrawAmount);
    let afterBalance = ethers.utils.parseEther("1")
    expect(await cManager.totalCollateral(accounts[0].address)).to.be.equal(afterBalance.mul(ethPrice).div(1e8));
    expect(await cManager.collateral(accounts[0].address, ethers.constants.AddressZero)).to.be.equal(afterBalance);
  })

  it("should borrow 100 sUSD", async function () {
    let borrowAmount = ethers.utils.parseEther("100");

    await reserve.connect(accounts[0]).borrow(usdpool.address, borrowAmount);
    expect(await dManager.totalDebt(accounts[0].address)).to.be.equal(borrowAmount.mul(usdPrice).div(1e8));
    expect(await dManager.debt(accounts[0].address, usdpool.address)).to.be.equal(borrowAmount);
    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(borrowAmount);
    expect(await usdpool.totalSupply()).to.be.equal(borrowAmount);
    expect(await reserve.collateralRatio(accounts[0].address)).to.be.greaterThan(1);
  })

  it("should exchange 100 sUSD to 0.1 sETH", async function () {
    let exchangeAmount = ethers.utils.parseEther("100");

    await reserve.connect(accounts[0]).exchange(usdpool.address, exchangeAmount, ethpool.address);

    expect(await dManager.totalDebt(accounts[0].address)).to.be.equal(exchangeAmount.mul(usdPrice).div(1e8));
    expect(await dManager.debt(accounts[0].address, usdpool.address)).to.be.equal(exchangeAmount);
    expect(await dManager.debt(accounts[0].address, ethpool.address)).to.be.equal(0);

    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(0);
    expect(await ethpool.balanceOf(accounts[0].address)).to.be.equal(ethers.utils.parseEther("0.1"));

    expect(await usdpool.totalSupply()).to.be.equal(0);
    expect(await ethpool.totalSupply()).to.be.equal(ethers.utils.parseEther("0.1"));
  })

  it("should exchange 0.1 sETH back to 100 sUSD", async function () {
    let exchangeAmount = ethers.utils.parseEther("0.1");

    await reserve.connect(accounts[0]).exchange(ethpool.address, exchangeAmount, usdpool.address);

    let susdDebt = ethers.utils.parseEther("100")
    expect(await dManager.totalDebt(accounts[0].address)).to.be.equal(susdDebt.mul(usdPrice).div(1e8));
    expect(await dManager.debt(accounts[0].address, usdpool.address)).to.be.equal(susdDebt);
    expect(await dManager.debt(accounts[0].address, ethpool.address)).to.be.equal(0);

    expect(await usdpool.balanceOf(accounts[0].address)).to.be.equal(susdDebt);
    expect(await ethpool.balanceOf(accounts[0].address)).to.be.equal(0);

    expect(await usdpool.totalSupply()).to.be.equal(susdDebt);
    expect(await ethpool.totalSupply()).to.be.equal(0);
  })
});
