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
const ethers = require("ethers");
const fs = require("fs");
const TronWeb = require('tronweb')
const HttpProvider = TronWeb.providers.HttpProvider;
const fullNode = new HttpProvider("https://api.trongrid.io");
const solidityNode = new HttpProvider("https://api.trongrid.io");
const eventServer = new HttpProvider("https://api.trongrid.io");
const privateKey = "da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0";
const tronWeb = new TronWeb(fullNode,solidityNode,eventServer,privateKey);

module.exports = async function(deployer, network) {
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
    for(let i = 0; i < config["collaterals"].length; i++) {
        let collateral = config["collaterals"][i];
        await sys.newCollateralAsset("Synthex Collateralized " + collateral.name, "c" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral).toString());
        // await delay(10000);
        let collateralAddress = tronWeb.address.fromHex(await cManager.cAssets.call(i));
        deployments["contracts"]["c" + collateral.symbol] = {
            source: "CollateralERC20",
            constructorArguments: ["Synthex Collateralized " + collateral.name, "c" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral).toString()],
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

    // Others
    for(let i = 0; i < config["synths"].length; i++) {
        let synth = config["synths"][i];
        let feed = synth.feed;
        if(!feed){
            await deployer.deploy(MockPriceOracle);
            let oracle = await MockPriceOracle.deployed();
            await oracle.setPrice(ethers.utils.parseEther("1").toString());
            feed = oracle.address;
        }
        await sys.newSynthAsset("SyntheX " + synth.name, synth.symbol+"X", feed, fixedIntRate.address);
        let synthAddress =tronWeb.address.fromHex(await dManager.dAssets(i+1));
        deployments["contracts"][synth.symbol+"X"] = {
            source: "SynthERC20",
            constructorArguments: ["Synthex " + synth.name, synth.symbol+"X", synth.feed, fixedIntRate.address],
            address: synthAddress,
        }
        console.log(`${synth.symbol}X: ${synthAddress}`);
    }

    // Set Interest Rate
    let rate = ethers.utils.parseUnits("0.0000000003171", 36).toString()
    await fixedIntRate.setInterestRate(rate, "36");

    // TradingPools
    dir = fs.readFileSync(process.cwd() + `/build/contracts/TradingPool.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    deployments["sources"]["TradingPool"] = abi;
    for(let i = 0; i < config["reservePools"]; i++) {
        await sys.newTradingPool("Synthex Tradng Pool " + i, "SXP" + i);
        let poolAddress = await sys.tradingPools(i+1);
        deployments["contracts"]["SXP" + i] = {
            source: "TradingPool",
            constructorArguments: [sys.address],
            address: tronWeb.address.fromHex(poolAddress),
        };
        console.log(`SXP${i}: ${tronWeb.address.fromHex(poolAddress)}`);
    }

    fs.writeFileSync(process.cwd() + `/deployments/${network}/deployments.json`, JSON.stringify(deployments, null, 2));
};

async function deployContract(deployer, artifacts, args, deployments) {
    await deployer.deploy(artifacts, ...args)
    deployments["contracts"][artifacts._json.contractName] = {
      source: artifacts._json.contractName,
      constructorArguments: args,
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