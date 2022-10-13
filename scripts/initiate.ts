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
    deployments["sources"]["CollateralERC20"] = abi;
    dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/mock/MockPriceOracle.sol/MockPriceOracle.json`, "utf-8");
    abi = JSON.parse(dir)
    abi = abi.abi;
    deployments["sources"]["PriceOracle"] = abi;

    let collaterals = {};
    let weth;
    (deployments as any)["sources"]["CollateralERC20"] = abi;
    for(let i = 0; i < (config as any)["collaterals"].length; i++) {
        let collateral = (config as any)["collaterals"][i];
        let feed = collateral.feed;
        if(!feed){
            const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
            const oracle = await MockPriceOracle.deploy();
            await oracle.setPrice(ethers.utils.parseUnits(collateral.price, 8).toString());
            feed = oracle.address;
            deployments["contracts"]["c"+collateral.symbol+"_Oracle"] = {
                source: "PriceOracle",
                constructorArguments: [],
                address: oracle.address,
            }
        }

        let address = collateral.address;
        if(address == "0x0000000000000000000000000000000000000000"){
            const WETH = await ethers.getContractFactory("WETH");
            const _weth = await WETH.deploy();
            address = _weth.address;
            weth = _weth;
        }

        await contracts.sys.newCollateralAsset("SyntheX Collateralized " + collateral.name, "c" + collateral.symbol, collateral.decimals ?? 18, address, feed, ethers.utils.parseEther(collateral.minCollateral));
        let collateralAddress = await contracts.cManager.cAssets(i);
        (deployments as any)["contracts"]["SynthexCollateralized" + collateral.name] = {
            source: "CollateralERC20",
            constructorArguments: ["Synthex Collateralized" + collateral.name, "c" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral)],
            address: collateralAddress,
        }
        if(logs) console.log("c" + collateral.symbol, collateralAddress);
        (collaterals as any)["c"+collateral.symbol.toLowerCase()] = (CollateralERC20.attach(collateralAddress));
    }

    const SynthERC20 = await ethers.getContractFactory("SynthERC20");
    const DebtTracker = await ethers.getContractFactory("DebtTracker");
    dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/SynthERC20.sol/SynthERC20.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    (deployments as any)["sources"]["SynthERC20"] = abi;
    dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/DebtTracker.sol/DebtTracker.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    (deployments as any)["sources"]["DebtTracker"] = abi;
    let synths = {};
    for(let i = 0; i < (config as any)["synths"].length; i++) {
        let synth = (config as any)["synths"][i];
        let feed = synth.feed;
        if(!feed){
            const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
            const oracle = await MockPriceOracle.deploy();
            await oracle.setPrice(ethers.utils.parseUnits(synth.price, 8).toString());
            feed = oracle.address;
            deployments["contracts"][synth.symbol+"X"+"_Oracle"] = {
                source: "PriceOracle",
                constructorArguments: [],
                address: oracle.address,
            }
            if(logs) console.log(`${synth.symbol}X_ORACLE`, oracle.address);
        }

        await contracts.sys.newSynthAsset("SyntheX " + synth.name, "X" + synth.symbol, feed, contracts.fixedIntRate.address);
        
        let debtTracker = DebtTracker.attach(await contracts.dManager.dAssets(i));
        let synthAddress = await debtTracker.synth();
        (deployments as any)["contracts"][synth.symbol+"X"] = {
            source: "SynthERC20",
            constructorArguments: ["Synthex " + synth.name, synth.symbol+"X", feed, contracts.fixedIntRate.address],
            address: synthAddress,
        };
        (deployments as any)["contracts"][synth.symbol+"X_DEBT"] = {
            source: "DebtTracker",
            constructorArguments: ["Synthex " + synth.name, synth.symbol+"X", feed, contracts.fixedIntRate.address],
            address: debtTracker.address,
        }
        if(logs) console.log(synth.symbol+"X", synthAddress);
        (synths as any)[synth.symbol.toLowerCase() + "pool"] = SynthERC20.attach(synthAddress);
        (synths as any)[synth.symbol.toLowerCase() + "debt"] = debtTracker;
    }

    const USDPriceOracle = await ethers.getContractFactory("MockPriceOracle");
    let oracle = await USDPriceOracle.deploy();
    await oracle.deployed();
    await oracle.setPrice("100000000");
    if(logs) console.log("USDX_ORACLE", oracle.address);
    await contracts.sys.newSynthAsset("SyntheX USD", "USDX", oracle.address, contracts.fixedIntRate.address);
    let USDDebtX = DebtTracker.attach(await contracts.dManager.dAssets((config as any)["synths"].length));
    let usdSynth = SynthERC20.attach(await USDDebtX.synth());
    (deployments as any)["contracts"]["USDX"] = {
        source: "SynthERC20",
        constructorArguments: ["Synthex USD", "USDX", oracle.address, contracts.fixedIntRate.address],
        address: usdSynth.address,
    };
    (deployments as any)["contracts"]["USDX_DEBT"] = {
        source: "DebtTracker",
        constructorArguments: ["Synthex USD", "USDX", oracle.address, contracts.fixedIntRate.address],
        address: USDDebtX.address,
    };
    (synths as any)["usdpool"] = usdSynth;
    (synths as any)["usddebt"] = USDDebtX;
    if(logs) console.log("USDX", usdSynth.address);

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
        if(logs) console.log("SXP" + i, poolAddress);
    }

    return {...synths, ...collaterals, ...pools, weth};
}