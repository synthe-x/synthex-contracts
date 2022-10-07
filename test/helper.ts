import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import main from "../scripts/index";

describe("Testing helpers", function () {
  let reserve: Contract, cManager: Contract, dManager: Contract, 
  usdOracle: Contract, ethOracle: Contract, btcOracle: Contract, 
  helper: Contract, fixedIntRate: Contract;
  let usdpool: any, btcpool: Contract, ethpool: Contract, system: Contract, forthpool: Contract;
  let PriceOracle, Pool: any;
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

    const deployments = await main()
    reserve = deployments.reserve
    cManager = deployments.cManager
    dManager = deployments.dManager
    helper = deployments.helper
    system = deployments.sys
    
    let scxeth = deployments.scxeth
    await scxeth.setPriceOracle(ethOracle.address)
    // dusdpool = deployments.usddebt
    usdpool = deployments.usdpool
    await usdpool.setPriceOracle(usdOracle.address)
    // dbtcpool = deployments.btcddebt
    btcpool = deployments.btcpool
    await btcpool.setPriceOracle(btcOracle.address)
    // dethpool = deployments.ethdebt
    ethpool = deployments.ethpool
    await ethpool.setPriceOracle(ethOracle.address)
  })
  
  it("check all assets", async function () {
    let cAssets = await helper.getCollateralAssets();
    let dAssets = await helper.getDebtAssets();
    expect(cAssets.length).to.be.equal(1);
    expect(dAssets.length).to.be.equal(3);
  })

  it("user adds collateral and issues assets", async function () {
    await system.connect(accounts[0]).deposit(ethers.constants.AddressZero, ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
    await system.connect(accounts[0]).borrow(usdpool.address, ethers.utils.parseEther("100"));
  })

  it("check all assets", async function () {
    let cAssets = await helper.callStatic.getUserPosition(accounts[0].address)
    expect(cAssets['collaterals'].length).to.be.equal(1);
    expect(cAssets['debts'].length).to.be.equal(3);
    expect(cAssets['debts'][2]['amount']).to.be.greaterThan("0");
  })
});
