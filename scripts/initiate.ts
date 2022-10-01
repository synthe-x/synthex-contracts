import { ethers } from "hardhat";
import { Liquidator } from '../typechain-types/contracts/Liquidator';
import fs from "fs";
import main from ".";
import { Contract } from "ethers";

export default async function init(dManager: Contract, cManager: Contract, fixedIntRate: Contract, deployments: any = {}, logs: boolean = true) {
    let config = fs.readFileSync( process.cwd() + "/deployments/goerli/config.json", "utf8");
    config = JSON.parse(config)
    
    const CollateralERC20 = await ethers.getContractFactory("CollateralERC20");
    (deployments as any)["sources"]["CollateralERC20"] = CollateralERC20.interface.format(ethers.utils.FormatTypes.json);
    
    for(let i = 0; i < (config as any)["collaterals"].length; i++) {
        let collateral = (config as any)["collaterals"][i];
        await cManager.create("Synthex Collateralized " + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral));
        let collateralInstance = CollateralERC20.attach(await cManager.cAssets(i));
        (deployments as any)["contracts"]["SynthexCollateralized" + collateral.name] = {
            source: "CollateralERC20",
            constructorArguments: ["Synthex Collateralized" + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral)],
            address: collateralInstance.address,
        }
        console.log("Deployed collateral", collateral.name, "at", collateralInstance.address);
    }

    const SynthERC20 = await ethers.getContractFactory("SynthERC20");
    (deployments as any)["sources"]["SynthERC20"] = SynthERC20.interface.format(ethers.utils.FormatTypes.json);
    
    for(let i = 0; i < (config as any)["synths"].length; i++) {
        let synth = (config as any)["synths"][i];
        await dManager.create("Synthex " + synth.name, "sx" + synth.symbol, synth.feed, fixedIntRate.address);
        let synthInstance = SynthERC20.attach(await dManager.dAssets(i));
        (deployments as any)["contracts"]["Synthex" + synth.name] = {
            source: "SynthERC20",
            constructorArguments: ["Synthex " + synth.name, "sx" + synth.symbol, synth.feed, fixedIntRate.address],
            address: synthInstance.address,
        }
        console.log("Deployed synth", synth.name, "at", synthInstance.address);
    }
}