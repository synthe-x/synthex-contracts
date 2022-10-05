import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from 'ethers';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import _main from "../scripts/test_scripts/filledContracts";
import { ReservePool__factory } from "../typechain-types";

describe("Testing helpers", function () {
    let reserve: Contract, cManager: Contract, dManager: Contract, 
    usdOracle: Contract, ethOracle: Contract, btcOracle: Contract, 
    helper: Contract, fixedIntRate: Contract, sys: Contract, reservepool: Contract;
    let usdpool: any, btcpool: Contract, ethpool: Contract, linkpool: Contract, forthpool: Contract;
    let PriceOracle, ReservePool: ReservePool__factory, ERC20: any;
    let usdPrice = 0, btcPrice = 0, ethPrice = 0;
    let accounts: SignerWithAddress[];

    before(async() => {
        accounts = await ethers.getSigners();

        let resp = await _main();
        sys = resp.sys;
        helper = resp.helper;
        reserve = resp.reserve;
        usdpool = resp.usdpool;
        btcpool = resp.btcpool
        btcOracle = resp.btcOracle;

        ReservePool = await ethers.getContractFactory("ReservePool");
        ERC20 = await ethers.getContractFactory("ERC20");
    })

    
    it("create debt pool", async () => {
        await reserve.connect(accounts[0]).createPool();
        reservepool = ReservePool.attach(await reserve.pools(1));
    })
    
    it("u1: provide 10 ETH collateral and borrow 200sUSD", async function () {
        let collateralAmount = ethers.utils.parseEther("10")
        let borrowAmount = ethers.utils.parseEther("200")
        await reserve.connect(accounts[0]).increaseCollateral(ethers.constants.AddressZero, collateralAmount, {value: ethers.utils.parseEther("10")});
        await reserve.connect(accounts[0]).borrow(usdpool.address, borrowAmount);
        expect(await reserve.callStatic.collateralRatio(accounts[0].address)).to.be.equal(collateralAmount.mul(ethers.constants.WeiPerEther.mul("1000")).div(borrowAmount));
    })

    it("u1: enter debt pool with 200sUSD", async () => {
        let amount = ethers.utils.parseEther("200")

        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal("0");
        await reserve.connect(accounts[0]).enterPool(1, usdpool.address, amount);
        expect(await reservepool.balanceOf(accounts[0].address)).to.be.equal(amount);
        expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.equal(amount);
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(amount);
        expect(await ERC20.attach(await usdpool.synth()).balanceOf(accounts[0].address)).to.be.equal(amount);
    })

    it("u1: exit debt pool 100sUSD", async () => {
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("200"));
        await reserve.connect(accounts[0]).exitPool(1, usdpool.address, ethers.utils.parseEther("100"));
        expect(await reservepool.balanceOf(accounts[0].address)).to.be.equal(ethers.utils.parseEther("100"));
        expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.equal(ethers.utils.parseEther("100"));
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("100"));
        expect(await ERC20.attach(await usdpool.synth()).balanceOf(accounts[0].address)).to.be.equal(ethers.utils.parseEther("200"));
    })

    it("u1: exchange 100sUSD to 0.005 sBTC", async () => {
        let exchangeAmount = ethers.utils.parseEther("100");
        await reserve.connect(accounts[0]).exchange(1, usdpool.address, exchangeAmount, btcpool.address);
        expect(await reservepool.balanceOf(accounts[0].address)).to.be.equal(exchangeAmount);
        expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.equal(exchangeAmount);
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(exchangeAmount);
        expect(await ERC20.attach(await btcpool.synth()).balanceOf(accounts[0].address)).to.be.equal(ethers.utils.parseEther("0.005"));
    })

    /* -------------------------------------------------------------------------- */
    /*                                    User2                                   */
    /* -------------------------------------------------------------------------- */
    it("u2: provide 10 ETH collateral and borrow 1000sUSD", async function () {
        let enterAmount = ethers.utils.parseEther("1000");
        await reserve.connect(accounts[1]).increaseCollateral(ethers.constants.AddressZero, ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
        await reserve.connect(accounts[1]).borrow(usdpool.address, enterAmount);
        expect(await reserve.callStatic.collateralRatio(accounts[1].address)).to.be.equal(ethers.utils.parseEther("10"));
    })

    it("u2: enter debt pool with 1000sUSD", async () => {
        let enterAmount = ethers.utils.parseEther("1000");
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("100"));
        await reserve.connect(accounts[1]).enterPool(1, usdpool.address, enterAmount);
        expect(await reservepool.balanceOf(accounts[1].address)).to.be.equal(enterAmount);
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("1100"));
        expect(await reservepool.getBorrowBalanceUSD(accounts[1].address)).to.be.equal(enterAmount);
    })
    /* -------------------------------------------------------------------------- */
    /*                             User 1 makes profit                            */
    /* -------------------------------------------------------------------------- */
    it("price of sBTC shoots up, debt of u1 < u2", async () => {
        await btcOracle.connect(accounts[0]).setPrice("4000000000000");
        expect(await reservepool.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("1200"));
        // expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.greaterThan(ethers.utils.parseEther("100"));
        // expect(await reservepool.getBorrowBalanceUSD(accounts[1].address)).to.be.lessThan(ethers.utils.parseEther("1000"));
    })

    it("price of sBTC goes down, debt of u1 > u2", async () => {
        await btcOracle.connect(accounts[0]).setPrice("1000000000000");
        expect(await reservepool.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("1050"));
        // expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.lessThan(ethers.utils.parseEther("1050").mul("1").div("10"));
        // expect(await reservepool.getBorrowBalanceUSD(accounts[1].address)).to.be.greaterThan(ethers.utils.parseEther("1050").mul("9").div("10"));
    })

    it("check all assets", async function () {
        let cAssets0 = await helper.callStatic.getUserPosition(accounts[0].address)
        // console.log(cAssets0['poolAssets']);
        expect(cAssets0['collaterals'].length).to.be.equal(1);
        expect(cAssets0['debts'].length).to.be.equal(2);

        let cAssets1 = await helper.callStatic.getUserPosition(accounts[1].address)
        // console.log(cAssets1['poolAssets']);
        expect(cAssets1['collaterals'].length).to.be.equal(1);
        expect(cAssets1['debts'].length).to.be.equal(2);
        // expect(cAssets['debts'][0]['amount']).to.be.greaterThan("0");
    })
});
