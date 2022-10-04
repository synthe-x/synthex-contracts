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
    let PriceOracle, ReservePool: ReservePool__factory, Pool: any;
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

        ReservePool = await ethers.getContractFactory("ReservePool");
    })

    
    it("create debt pool", async () => {
        await reserve.connect(accounts[0]).createPool();
        reservepool = ReservePool.attach(await reserve.pools(1));
        await sys.setReservePool(reservepool.address, true);
    })
    
    it("u1: provide 10 ETH collateral and borrow 200sUSD", async function () {
        await reserve.connect(accounts[0]).increaseCollateral(ethers.constants.AddressZero, ethers.utils.parseEther("10"), {value: ethers.utils.parseEther("10")});
        await reserve.connect(accounts[0]).borrow(usdpool.address, ethers.utils.parseEther("200"));
        expect(await reserve.callStatic.collateralRatio(accounts[0].address)).to.be.equal(ethers.utils.parseEther("50"));
    })

    it("u1: enter debt pool with 200sUSD", async () => {
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal("0");
        await reserve.connect(accounts[0]).enterPool(1, usdpool.address, ethers.utils.parseEther("200"));
        expect(await reservepool.balanceOf(accounts[0].address)).to.be.equal(ethers.utils.parseEther("200"));
        expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.equal(ethers.utils.parseEther("200"));
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("200"));
    })

    it("u1: exit debt pool 100sUSD", async () => {
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("200"));
        await reserve.connect(accounts[0]).exitPool(1, usdpool.address, ethers.utils.parseEther("100"));
        expect(await reservepool.balanceOf(accounts[0].address)).to.be.equal(ethers.utils.parseEther("100"));
        expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.equal(ethers.utils.parseEther("100"));
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("100"));
    })

    it("u1: exchange 100sUSD to 0.01 sBTC", async () => {
        await reserve.connect(accounts[0]).exchange(1, usdpool.address, ethers.utils.parseEther("50"), btcpool.address);
        expect(await reservepool.balanceOf(accounts[0].address)).to.be.equal(ethers.utils.parseEther("100"));
        expect(await reservepool.getBorrowBalanceUSD(accounts[0].address)).to.be.equal(ethers.utils.parseEther("100"));
        expect(await reservepool.callStatic.getTotalDebtUSD()).to.be.equal(ethers.utils.parseEther("100"));
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

    it("check all assets", async function () {
        let cAssets = await helper.callStatic.getUserPosition(accounts[0].address)
        expect(cAssets['collaterals'].length).to.be.equal(1);
        expect(cAssets['debts'].length).to.be.equal(2);
        // expect(cAssets['debts'][0]['amount']).to.be.greaterThan("0");
    })
});
