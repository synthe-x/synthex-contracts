import { ethers } from "hardhat";
import fs from "fs";
import { Contract } from "ethers";
import hre from "hardhat";
import { Deployments } from './index';

export default async function initiate(contracts: Deployments, deployments: any = {}, logs: boolean = true) {
    let config = fs.readFileSync( process.cwd() + `/deployments/${hre.network.name}/config.json`, "utf8");
    config = JSON.parse(config);

    const CollateralERC20 = await ethers.getContractFactory("CollateralERC20");
    let dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/CollateralERC20.sol/CollateralERC20.json`, "utf-8");
    let abi = JSON.parse(dir)
    abi = abi.abi;
    let collaterals = {};
    (deployments as any)["sources"]["CollateralERC20"] = abi;
    for(let i = 0; i < (config as any)["collaterals"].length; i++) {
        let collateral = (config as any)["collaterals"][i];
        await contracts.sys.newCollateralAsset("SyntheX Collateralized " + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral));
        let collateralAddress = await contracts.cManager.cAssets(i);
        (deployments as any)["contracts"]["SynthexCollateralized" + collateral.name] = {
            source: "CollateralERC20",
            constructorArguments: ["Synthex Collateralized" + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral)],
            address: collateralAddress,
        }
        console.log("scx" + collateral.symbol, collateralAddress);
        (collaterals as any)["scx"+collateral.symbol.toLowerCase()] = (CollateralERC20.attach(collateralAddress));
    }

    const SynthERC20 = await ethers.getContractFactory("SynthERC20");
    const DebtTracker = await ethers.getContractFactory("DebtTracker");
    dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/SynthERC20.sol/SynthERC20.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    let synths = {};
    (deployments as any)["sources"]["SynthERC20"] = abi;
    for(let i = 0; i < (config as any)["synths"].length; i++) {
        let synth = (config as any)["synths"][i];
        await contracts.sys.newSynthAsset("SyntheX " + synth.name, "X" + synth.symbol, synth.feed, contracts.fixedIntRate.address);
        
        let debtTracker = DebtTracker.attach(await contracts.dManager.dAssets(i));
        let synthAddress = await debtTracker.synth();
        (deployments as any)["contracts"]["Synthex" + synth.name] = {
            source: "SynthERC20",
            constructorArguments: ["Synthex " + synth.name, "sx" + synth.symbol, synth.feed, contracts.fixedIntRate.address],
            address: synthAddress,
        }
        console.log("x"+synth.symbol, synthAddress);
        (synths as any)[synth.symbol.toLowerCase() + "pool"] = SynthERC20.attach(synthAddress);
        (synths as any)[synth.symbol.toLowerCase() + "debt"] = debtTracker;
    }

    const USDPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    let oracle = await USDPriceOracle.deploy();
    await oracle.deployed();
    console.log("xUSD oracle", oracle.address);
    await contracts.sys.newSynthAsset("SyntheX USD", "USDX", oracle.address, contracts.fixedIntRate.address);
    let xUSDDebt = DebtTracker.attach(await contracts.dManager.dAssets((config as any)["synths"].length));
    (synths as any)["usdpool"] = SynthERC20.attach(await xUSDDebt.synth());
    (synths as any)["usddebt"] = xUSDDebt;
    console.log("xUSD", (synths as any)["usdpool"].address);

    let rate = ethers.utils.parseUnits("0.0000000003171", 36)
    await contracts.fixedIntRate.setInterestRate(rate, "36");

    const ReservePool = await ethers.getContractFactory("TradingPool");
    dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/pool/TradingPool.sol/TradingPool.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    let pools = {};
    (deployments as any)["sources"]["TradingPool"] = abi;
    for(let i = 0; i < (config as any)["reservePools"]; i++) {
        await contracts.sys.newTradingPool("SyntheX Reserve Pool " + i, "sxp" + i);
        let poolAddress = await contracts.sys.tradingPools(i+1);
        (deployments as any)["contracts"]["TradingPool" + i] = {
            source: "TradingPool",
            constructorArguments: [contracts.sys.address],
            address: poolAddress,
        };
        (pools as any)["reservepool" + i] = ReservePool.attach(poolAddress);
        console.log("SXP" + i, poolAddress);
    }

    return {...synths, ...collaterals, ...pools};
}