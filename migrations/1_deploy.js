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
const fullNode = new HttpProvider("https://api.trongrid.io");
const solidityNode = new HttpProvider("https://api.trongrid.io");
const eventServer = new HttpProvider("https://api.trongrid.io");
const privateKey = "e58a6e240a4d5a32fe8ec34509cb0f7d631a8ea73771f09073c76213b64eb74a";
const tronWeb = new TronWeb(fullNode,solidityNode,eventServer,privateKey);

module.exports = async function(deployer, network) {
    deployer.then(async () => {
    let deployments = fs.readFileSync(process.cwd() + `/deployments/${network}/deployments.json`, "utf8");
    deployments = JSON.parse(deployments);
    deployments["contracts"] = {};
    deployments["sources"] = {};
    
    await deployContract(deployer, AddressResolver, [], deployments);
    let addr = await AddressResolver.deployed();
    await deployContract(deployer, System, [tronWeb.address.fromHex(AddressResolver.address), ethers.utils.parseEther("1.3").toString(), ethers.utils.parseEther("2.0").toString()], deployments);
    let sys = await System.deployed();
    await deployContract(deployer, Reserve, [tronWeb.address.fromHex(System.address)], deployments);
    let reserve = await Reserve.deployed();
    await deployContract(deployer, DebtManager, [tronWeb.address.fromHex(System.address)], deployments);
    let dManager = await DebtManager.deployed();
    await deployContract(deployer, CollateralManager, [tronWeb.address.fromHex(System.address)], deployments)
    let cManager = await CollateralManager.deployed();
    // await deployContract(deployer, Helper, [tronWeb.address.fromHex(System.address)], deployments);
    // let helper = await Helper.deployed();
    await deployContract(deployer, FixedInterestRate, [tronWeb.address.fromHex(System.address)], deployments);
    let fixedIntRate = await FixedInterestRate.deployed();
    await deployContract(deployer, Liquidator, [tronWeb.address.fromHex(System.address)], deployments);
    let liq = await Liquidator.deployed();

    await addr.importAddresses(
        ["SYSTEM", "RESERVE", "DEBT_MANAGER", "COLLATERAL_MANAGER", "LIQUIDATOR"].map((x) => ethers.utils.formatBytes32String(x)), 
        [System.address, Reserve.address, DebtManager.address, CollateralManager.address, Liquidator.address]
    )

    let config = fs.readFileSync( process.cwd() + `/deployments/${network}/config.json`, "utf8");
    config = JSON.parse(config);

    /* -------------------------------------------------------------------------- */
    /*                                 Collaterals                                */
    /* -------------------------------------------------------------------------- */
    let dir = fs.readFileSync(process.cwd() + `/build/contracts/CollateralERC20.json`, "utf-8");
    let abi = JSON.parse(dir)
    abi = abi.abi;
    deployments["sources"]["CollateralERC20"] = abi;
    dir = fs.readFileSync(process.cwd() + `/build/contracts/MockPriceOracle.json`, "utf-8");
    abi = JSON.parse(dir)
    abi = abi.abi;
    deployments["sources"]["PriceOracle"] = abi;
    for(let i = 0; i < config["collaterals"].length; i++) {
        let collateral = config["collaterals"][i];
        let feed = collateral.feed;
        if(!feed){
            await deployer.deploy(MockPriceOracle);
            let oracle = await MockPriceOracle.deployed();
            await oracle.setPrice(ethers.utils.parseUnits(collateral.price, 8).toString());
            feed = oracle.address;
            deployments["contracts"]["c"+collateral.symbol+"_Oracle"] = {
                source: "PriceOracle",
                address: tronWeb.address.fromHex(oracle.address),
            }
        }
        let address = collateral.address;
        if(address == "0x0000000000000000000000000000000000000000"){
            await deployContract(deployer, WTRX, [], deployments);
            address = (await WTRX.deployed()).address;
        }
        await sys.newCollateralAsset(
            "Synthex Collateralized " + collateral.name, 
            "c" + collateral.symbol, collateral.decimals, address, feed, 
            ethers.utils.parseUnits(collateral.minCollateral, collateral.decimals).toString()
        );

        // await delay(10000);
        let collateralAddress = tronWeb.address.fromHex(await cManager.cAssets.call(i));
        deployments["contracts"]["c" + collateral.symbol] = {
            source: "CollateralERC20",
            address: collateralAddress,
        }
        console.log(`c${collateral.symbol}:`, collateralAddress);
    }

    /* -------------------------------------------------------------------------- */
    /*                                   Synths                                   */
    /* -------------------------------------------------------------------------- */
    dir = fs.readFileSync(process.cwd() + `/build/contracts/SynthERC20.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    deployments["sources"]["SynthERC20"] = abi;
    dir = fs.readFileSync(process.cwd() + `/build/contracts/DebtTracker.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    deployments["sources"]["DebtTracker"] = abi;

    // Others
    for(let i = 0; i < config["synths"].length; i++) {
        let synth = config["synths"][i];
        let feed = synth.feed;
        if(!feed){
            await deployer.deploy(MockPriceOracle);
            let oracle = await MockPriceOracle.deployed();
            await oracle.setPrice(ethers.utils.parseUnits(synth.price, 8).toString());
            feed = oracle.address;
            deployments["contracts"][synth.symbol+"X"+"_Oracle"] = {
                source: "PriceOracle",
                address: tronWeb.address.fromHex(oracle.address),
            }
        }
        await sys.newSynthAsset("SyntheX " + synth.name, synth.symbol+"X", feed, fixedIntRate.address);

        let synthAddress =tronWeb.address.fromHex(await dManager.dAssets(i));
        deployments["contracts"]["DebtTracker"+synth.symbol+"X"] = {
            source: "DebtTracker",
            address: synthAddress,
        }
        
        console.log(`DebtTracker${synth.symbol}X: ${synthAddress}`);
    }

    // Set Interest Rate
    let rate = ethers.utils.parseUnits("0.0000000003171", 18).toString()
    await fixedIntRate.setInterestRate(rate);

    // TradingPools
    dir = fs.readFileSync(process.cwd() + `/build/contracts/TradingPool.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    let tradingPools = config["tradingPools"];
    deployments["sources"]["TradingPool"] = abi;
    for(let i = 0; i < tradingPools.length; i++) {
        await sys.newTradingPool(config["tradingPools"][i].name, config["tradingPools"][i].symbol);
        let poolAddress = await sys.tradingPools(i+1);
        deployments["contracts"][config["tradingPools"][i].symbol] = {
            source: "TradingPool",
            address: tronWeb.address.fromHex(poolAddress),
        };
        console.log(`${config["tradingPools"][i].symbol}: ${tronWeb.address.fromHex(poolAddress)}`);
    }

    fs.writeFileSync(process.cwd() + `/deployments/${network}/deployments.json`, JSON.stringify(deployments, null, 2));
})
};

async function deployContract(deployer, artifacts, args, deployments) {
    await deployer.deploy(artifacts, ...args)
    deployments["contracts"][artifacts._json.contractName] = {
      source: artifacts._json.contractName,
      address: tronWeb.address.fromHex(artifacts.address),
    };
    const dir = fs.readFileSync(process.cwd() + `/build/contracts/${artifacts._json.contractName}.json`, "utf-8");
    let abi = JSON.parse(dir)
    abi = abi.abi;
    deployments["sources"][artifacts._json.contractName] = abi;
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}  