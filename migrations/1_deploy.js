var AddressResolver = artifacts.require("AddressResolver");
var System = artifacts.require("System")
var Reserve = artifacts.require("Reserve")
var Exchanger = artifacts.require("Exchanger")
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
    await deployContract(deployer, System, [AddressResolver.address], deployments);
    let sys = await System.deployed();
    await deployContract(deployer, Reserve, [System.address], deployments);
    let reserve = await Reserve.deployed();
    await deployContract(deployer, Exchanger, [System.address], deployments);
    let exchanger = await Exchanger.deployed();
    await deployContract(deployer, DebtManager, [System.address], deployments);
    let dManager = await DebtManager.deployed();
    await deployContract(deployer, CollateralManager, [System.address], deployments)
    let cManager = await CollateralManager.deployed();
    await deployContract(deployer, Helper, [System.address], deployments);
    let helper = await Helper.deployed();
    await deployContract(deployer, FixedInterestRate, [System.address], deployments);
    let fixedIntRate = await FixedInterestRate.deployed();
    await deployContract(deployer, Liquidator, [System.address], deployments);
    let liq = await Liquidator.deployed();

    await reserve.setMinCRatio(ethers.utils.parseEther("1.5").toString());
    await addr.importAddresses(
        ["SYSTEM", "RESERVE", "EXCHANGER", "DEBT_MANAGER", "COLLATERAL_MANAGER", "LIQUIDATOR"].map((x) => ethers.utils.formatBytes32String(x)), 
        [System.address, Reserve.address, Exchanger.address, DebtManager.address, CollateralManager.address, Liquidator.address]
    )

    let config = fs.readFileSync( process.cwd() + `/deployments/${network}/config.json`, "utf8");
    config = JSON.parse(config);

    let dir = fs.readFileSync(process.cwd() + `/build/contracts/CollateralERC20.json`, "utf-8");
    let abi = JSON.parse(dir)
    abi = abi.abi;
    deployments["sources"]["CollateralERC20"] = abi;
    for(let i = 0; i < config["collaterals"].length; i++) {
        let collateral = config["collaterals"][i];
        await cManager.create("Synthex Collateralized " + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral).toString());
        let collateralAddress = await cManager.cAssets.call(i);
        deployments["contracts"]["SynthexCollateralized" + collateral.name] = {
            source: "CollateralERC20",
            constructorArguments: ["Synthex Collateralized" + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral)],
            address: collateralAddress,
        }
        console.log("collateralAddress: ", collateralAddress);
    }

    dir = fs.readFileSync(process.cwd() + `/build/contracts/SynthERC20.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    deployments["sources"]["SynthERC20"] = abi;
    for(let i = 0; i < config["synths"].length; i++) {
        let synth = config["synths"][i];
        await dManager.create("SyntheX " + synth.name, "X" + synth.symbol, synth.feed, fixedIntRate.address);
        let synthAddress = await dManager.dAssets.call(i);
        deployments["contracts"]["Synthex" + synth.name] = {
            source: "SynthERC20",
            constructorArguments: ["Synthex " + synth.name, "sx" + synth.symbol, synth.feed, fixedIntRate.address],
            address: synthAddress,
        }
        console.log("synthAddress: ", synthAddress);
    }

    await deployer.deploy(MockPriceOracle);
    console.log("Deployed XUSD oracle at", MockPriceOracle.address);
    await dManager.create("SyntheX USD", "xUSD", MockPriceOracle.address, fixedIntRate.address);

    let rate = ethers.utils.parseUnits("0.0000000003171", 36).toString()
    await fixedIntRate.setInterestRate(rate, "36");

    dir = fs.readFileSync(process.cwd() + `/build/contracts/ReservePool.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    deployments["sources"]["ReservePool"] = abi;
    for(let i = 0; i < config["reservePools"]; i++) {
        await reserve.createPool();
        let poolAddress = await reserve.pools(i+1);
        deployments["contracts"]["ReservePool" + i] = {
            source: "ReservePool",
            constructorArguments: [sys.address],
            address: poolAddress,
        };
        console.log("poolAddress: ", poolAddress);
    }

    fs.writeFileSync(process.cwd() +  `/deployments/${network}/deployments.json`, JSON.stringify(deployments, null, 2));
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