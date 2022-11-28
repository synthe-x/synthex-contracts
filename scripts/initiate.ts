import { ethers } from "hardhat";
import fs from "fs";
import { Contract } from "ethers";
import hre from "hardhat";
import { Deployments } from './deploy';
import { DebtTracker } from '../typechain-types/contracts/DebtTracker';

export default async function initiate(contracts: Deployments, deployments: any = {}, logs: boolean = true, override = true) {
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
        if(override && deployments['contracts']["SynthexCollateralized" + collateral.name]){
            continue
        } else {
            let feed = collateral.feed;
            console.log('Deploying', collateral.name, '...');
            if(!feed){
                const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
                let oracle;
                if(override && deployments['contracts']["c"+collateral.symbol+"_Oracle"]){
                    oracle = MockPriceOracle.attach(deployments['contracts']["c"+collateral.symbol+"_Oracle"].address)
                }
                else {
                    try{
                        oracle = await MockPriceOracle.deploy();
                    } catch {
                        oracle = await MockPriceOracle.deploy();
                    }
                }
                try{
                    await oracle.setPrice(ethers.utils.parseUnits(collateral.price, 8).toString());
                } catch {
                    await oracle.setPrice(ethers.utils.parseUnits(collateral.price, 8).toString());
                }
                feed = oracle.address;
                deployments["contracts"]["c"+collateral.symbol+"_Oracle"] = {
                    source: "PriceOracle",
                    constructorArguments: [],
                    address: oracle.address,
                }
                console.log("c" + collateral.symbol + "_ORACLE", feed);
                fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
            }

            let address = collateral.address;
            if(address == "0x0000000000000000000000000000000000000000"){
                const WETH = await ethers.getContractFactory('WETH');
                
                let _weth;
                
                if(override && deployments['contracts']['W'+collateral.symbol]){
                    _weth = WETH.attach(deployments['contracts']['WETH'].address)
                }
                else {
                    try{
                        _weth = await WETH.deploy(collateral.name, collateral.symbol);
                    } catch {
                        _weth = await WETH.deploy(collateral.name, collateral.symbol);
                    }
                }
                address = _weth.address; 
                weth = _weth;
                dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/mock/WETH.sol/WETH.json`, "utf-8");
                abi = JSON.parse(dir)
                abi = abi.abi;
                deployments["sources"]['WETH'] = abi;
                deployments["contracts"]['W'+collateral.symbol] = {
                    source: 'WETH',
                    constructorArguments: [],
                    address: _weth.address,
                }
                console.log("WETH", _weth.address);
                (collaterals as any)['weth'] = _weth;
                fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
            }
            try{
                await contracts.sys.newCollateralAsset("SyntheX Collateralized " + collateral.name, "c" + collateral.symbol, collateral.decimals ?? 18, address, feed, ethers.utils.parseEther(collateral.minCollateral));
            } catch (err) {
                console.log('Errored while deploying synth...');
                delay(5000);
                continue;
                // await contracts.sys.newCollateralAsset("SyntheX Collateralized " + collateral.name, "c" + collateral.symbol, collateral.decimals ?? 18, address, feed, ethers.utils.parseEther(collateral.minCollateral));
            }
            let collateralAddress;
            try{ 
                collateralAddress = await contracts.cManager.cAssets(i);
            } catch (err) {
                collateralAddress = await contracts.cManager.cAssets(i);
            }
            
            (deployments as any)["contracts"]["SynthexCollateralized" + collateral.name] = {
                source: "CollateralERC20",
                constructorArguments: ["Synthex Collateralized" + collateral.name, "c" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral)],
                address: collateralAddress,
            }
            if(logs) console.log("c" + collateral.symbol, collateralAddress);
            (collaterals as any)["c"+collateral.symbol.toLowerCase()] = (CollateralERC20.attach(collateralAddress));
            fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
        }

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
        if(override && (deployments as any)["contracts"][synth.symbol+"X_DEBT"]){
            continue
        } else {
            let feed = synth.feed;
            console.log("Deploying", synth.name, '...');
            if(!feed){
                const MockPriceOracle = await ethers.getContractFactory("MockPriceOracle");
                let oracle;
                if(override && deployments['contracts'][synth.symbol+"X"+"_Oracle"]){
                    oracle = MockPriceOracle.attach(deployments['contracts'][synth.symbol+"X"+"_Oracle"].address)
                }
                else {
                    try{
                        oracle = await MockPriceOracle.deploy();
                    } catch {
                        oracle = await MockPriceOracle.deploy();
                    }
                }
                if(logs) console.log(`${synth.symbol}X_ORACLE`, oracle.address);
                try{
                    await oracle.setPrice(ethers.utils.parseUnits(synth.price, 8).toString());
                } catch {
                    await oracle.setPrice(ethers.utils.parseUnits(synth.price, 8).toString());
                }
                feed = oracle.address;
                deployments["contracts"][synth.symbol+"X"+"_Oracle"] = {
                    source: "PriceOracle",
                    constructorArguments: [],
                    address: oracle.address,
                }
                fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
            }
            try{
                await contracts.sys.newSynthAsset("SyntheX " + synth.name, synth.symbol+"X", feed, contracts.fixedIntRate.address);
            } catch (err){
                console.log('Errored while deploying synth...');
                delay(5000);
                continue;
                // await contracts.sys.newSynthAsset("SyntheX " + synth.name, synth.symbol+"X", feed, contracts.fixedIntRate.address);
            }
            let dasset;
            try{
                dasset = await contracts.dManager.dAssets(i);
            } catch (err){
                dasset = await contracts.dManager.dAssets(i);
            }
            if(dasset == ethers.constants.AddressZero){
                delay(5000);
                dasset = await contracts.dManager.dAssets(i);
            }
            let debtTracker = DebtTracker.attach(dasset);
            debtTracker = await debtTracker._deployed() as DebtTracker
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
            fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
        }
    }

    const TradingPool = await ethers.getContractFactory("TradingPool");
    dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/pool/TradingPool.sol/TradingPool.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    let pools = {};
    (deployments as any)["sources"]["TradingPool"] = abi;
    for(let i = 0; i < (config as any)["tradingPools"].length; i++) {
        if(override && (deployments as any)["contracts"][(config as any)["tradingPools"][i].symbol]){
            continue
        } else {
            await contracts.sys.newTradingPool((config as any)["tradingPools"][i].name, (config as any)["tradingPools"][i].symbol);
            let poolAddress = await contracts.sys.tradingPools(i+1);
            (deployments as any)["contracts"][(config as any)["tradingPools"][i].symbol] = {
                source: "TradingPool",
                constructorArguments: [contracts.sys.address],
                address: poolAddress,
            };
            let pool = TradingPool.attach(poolAddress);
            let synthsToEnable = (config as any)["tradingPools"][i].assets.map((symbol: string) => (deployments as any)["contracts"][symbol].address)
            await contracts.sys.enableSynthInTradingPool(i+1, synthsToEnable);
            (pools as any)["reservepool" + i] = pool
            if(logs) console.log((config as any)["tradingPools"][i].symbol, poolAddress);
            fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
        }
    }

    console.log("Done!");

    return {...synths, ...collaterals, ...pools, weth};
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));