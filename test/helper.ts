import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import _main from "../scripts/test_scripts/filledContracts";

describe("Testing helpers", function () {
  let reserve: Contract, cManager: Contract, dManager: Contract, 
  usdOracle: Contract, ethOracle: Contract, btcOracle: Contract, 
  helper: Contract, fixedIntRate: Contract;
  let usdpool: any, btcpool: Contract, ethpool: Contract, linkpool: Contract, forthpool: Contract;
  let PriceOracle, Pool: any;
  let usdPrice = 0, btcPrice = 0, ethPrice = 0;
  let accounts: SignerWithAddress[];

  before(async() => {
    accounts = await ethers.getSigners();

    let resp = await _main();
    helper = resp.helper;
    reserve = resp.reserve;
    usdpool = resp.usdpool
  })
  
  it("check all assets", async function () {
    let cAssets = await helper.getCollateralAssets();
    let dAssets = await helper.getDebtAssets();
    expect(cAssets.length).to.be.equal(1);
    expect(dAssets.length).to.be.equal(2);
  })

  it("user adds collateral and issues assets", async function () {
    await reserve.connect(accounts[0]).increaseCollateral(ethers.constants.AddressZero, ethers.utils.parseEther("1"), {value: ethers.utils.parseEther("1")});
    await reserve.connect(accounts[0]).borrow(usdpool.address, ethers.utils.parseEther("100"));
  })

  it("check all assets", async function () {
    let cAssets = await helper.callStatic.getUserPosition(accounts[0].address)
    expect(cAssets[1].length).to.be.equal(1);
    expect(cAssets[2].length).to.be.equal(2);
    expect(cAssets[2][0][1]).to.be.greaterThan("0");
  })
});
