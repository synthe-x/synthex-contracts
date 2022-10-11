var AddressResolver = artifacts.require("AddressResolver");
var System = artifacts.require("System")
var Reserve = artifacts.require("Reserve")
var DebtTracker = artifacts.require("DebtTracker")
var DebtManager = artifacts.require("DebtManager")
var CollateralManager = artifacts.require("CollateralManager")
var Helper = artifacts.require("Helper")
var FixedInterestRate = artifacts.require("FixedInterestRate")
var Liquidator = artifacts.require("Liquidator")
var MockPriceOracle = artifacts.require("MockPriceOracle")
var WTRX = artifacts.require("WTRX")


const ethers = require("ethers");
const fs = require("fs");
const TronWeb = require('tronweb')
const HttpProvider = TronWeb.providers.HttpProvider;
let node = "http://0.0.0.0:9090";
const fullNode = new HttpProvider(node);
const solidityNode = new HttpProvider(node);
const eventServer = new HttpProvider(node);
const privateKey = "52641f54dc5e1951657523c8e7a1c44ac76229a4b14db076dce6a6ce9ae9293d";
const tronWeb = new TronWeb(fullNode, solidityNode, eventServer, privateKey);

contract('Test', function (accounts) {
    let system, reserve, debtManager, collateralManager, liquidator, fixedIntRate, debtTracker, collateralERC20, wtrx;
    const THOUSAND_ETH = "1000000000000000000000";
    const ONE_ETH = "1000000000000000000";

    before(async () => {
        system = await System.deployed();
        reserve = await Reserve.deployed();
        debtManager = await DebtManager.deployed();
        collateralManager = await CollateralManager.deployed();
        liquidator = await Liquidator.deployed();
        fixedIntRate = await FixedInterestRate.deployed();
        wtrx = await WTRX.deployed();
    })
    it("Set setSafeCRatio", async function () {
        let resp = await system.setSafeCRatio(ethers.utils.parseEther("2.2"), { from: accounts[0]})
        console.log(resp);
    });

    it("deposit WTRX", async function () {
        await wtrx.approve(system.address, ONE_ETH);
        let deposit = await wtrx.deposit();
        let allowance = (await wtrx.allowance(accounts[0], system.address)).toString();
        let balance = (await wtrx.balanceOf(accounts[0])).toString();

        if(allowance == "0" || balance == "0") {
            console.log("ZERO", allowance, balance, allowance, deposit);
            return
        }

        // let resp = await collateralManager.collateral(accounts[0], wtrx.address);
        // console.log("Collateral before deposit:", resp.toString(), resp.div("1000000").toString());

        resp = await system.deposit(wtrx.address, "10000000000", { from: accounts[0] })
        console.log("Deposit", resp);

        // resp = await collateralManager.collateral(accounts[0], wtrx.address);
        // console.log("Collateral after deposit:", resp.toString(), resp.div("1000000").toString());
    });
    
    it("deposit TRC20", async function () {
        let token = tronWeb.address.fromHex("41797a77a34072e019a93422a96f8237278384a4ed")
        let systemAddress = tronWeb.address.fromHex(system.address)
        // console.log(accounts[0], token);
        let tokenInstance = await tronWeb.contract().at(token);
        let approval = await tokenInstance.approve(systemAddress, THOUSAND_ETH).send({from: accounts[0], shouldPollResponse: true});
        
        let allowance = (await tokenInstance.allowance(accounts[0], systemAddress).call()).toString();
        let balance = (await tokenInstance.balanceOf(accounts[0]).call()).toString();

        if(allowance == "0" || balance == "0") {
            console.log("ZERO ALLOWNACE", allowance, balance);
            return
        }

        let resp = await system.deposit(token, THOUSAND_ETH, { from: accounts[0] })
        console.log(resp);
    });

    it("borrow", async function () {
        let dAsset = await debtManager.dAssets(0);
        let asset = await debtManager.dAssetToAsset(dAsset);
        let resp = await system.borrow(asset, THOUSAND_ETH, { from: accounts[0] })
        console.log("Borrow", resp);
        await delay(5000)
    })

    it("check collateral", async function () {
        let resp = await system.collateralRatio(accounts[0])
        console.log("CRatio:", resp.toString(), resp.div("10000000000000000").toString());

        resp = await debtManager.totalDebt(accounts[0])
        console.log("Debt:", resp.toString(), resp.div(ONE_ETH).toString());

        resp = await collateralManager.totalCollateral(accounts[0])
        console.log("Collateral:", resp.toString(), resp.div(ONE_ETH).toString());
    })

    it("repay", async function () {
        let dAsset = await debtManager.dAssets(0);
        let asset = await debtManager.dAssetToAsset(dAsset);
        let resp = await system.repay(asset, THOUSAND_ETH, { from: accounts[0] })
        console.log("Repay", resp);
        await delay(5000);
    })

    it("check collateral", async function () {
        let resp = await system.collateralRatio(accounts[0])
        console.log("CRatio:", resp.toString(), resp.div("10000000000000000").toString());

        resp = await debtManager.totalDebt(accounts[0])
        console.log("Debt:", resp.toString(), resp.div(ONE_ETH).toString());

        resp = await collateralManager.totalCollateral(accounts[0])
        console.log("Collateral:", resp.toString(), resp.div(ONE_ETH).toString());
    })

    
    it("borrow", async function () {
        let dAsset = await debtManager.dAssets(0);
        let asset = await debtManager.dAssetToAsset(dAsset);
        let resp = await system.borrow(asset, THOUSAND_ETH, { from: accounts[0] })
        console.log("Borrow 2", resp);
        await delay(5000)
    })
    
    it("check collateral", async function () {
        let resp = await system.collateralRatio(accounts[0])
        console.log("CRatio:", resp.toString(), resp.div("10000000000000000").toString());

        resp = await debtManager.totalDebt(accounts[0])
        console.log("Debt:", resp.toString(), resp.div(ONE_ETH).toString());

        resp = await collateralManager.totalCollateral(accounts[0])
        console.log("Collateral:", resp.toString(), resp.div(ONE_ETH).toString());
    })

    it("exchange", async function () {
        let dAsset1 = await debtManager.dAssets(0);
        let asset1 = await debtManager.dAssetToAsset(dAsset1);
        let dAsset2 = await debtManager.dAssets(1);
        let asset2 = await debtManager.dAssetToAsset(dAsset2);

        dAsset1 = await debtManager.debt(accounts[0], asset1);
        dAsset2 = await debtManager.debt(accounts[0], asset2);
        console.log("Debt before exchanage:", dAsset1.toString(), dAsset2.toString());

        resp = await system.exchange("0", asset1, THOUSAND_ETH, asset2, { from: accounts[0] })
        console.log("Exchange", resp);
        await delay(5000)

        dAsset1 = await debtManager.debt(accounts[0], asset1);
        dAsset2 = await debtManager.debt(accounts[0], asset2);
        console.log("Debt before exchanage:", dAsset1.toString(), dAsset2.toString());
    })
});

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}