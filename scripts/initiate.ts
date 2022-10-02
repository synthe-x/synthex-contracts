import { ethers } from "hardhat";
import fs from "fs";
import { Contract } from "ethers";

export default async function init(dManager: Contract, cManager: Contract, fixedIntRate: Contract, deployments: any = {}, logs: boolean = true) {
    let config = fs.readFileSync( process.cwd() + "/deployments/goerli/config.json", "utf8");
    config = JSON.parse(config);

    const CollateralERC20 = await ethers.getContractFactory("CollateralERC20");
    let dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/CollateralERC20.sol/CollateralERC20.json`, "utf-8");
    let abi = JSON.parse(dir)
    abi = abi.abi;
    let collaterals = {};
    (deployments as any)["sources"]["CollateralERC20"] = abi;
    for(let i = 0; i < (config as any)["collaterals"].length; i++) {
        let collateral = (config as any)["collaterals"][i];
        await cManager.create("Synthex Collateralized " + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral));
        let collateralAddress = await cManager.cAssets(i);
        (deployments as any)["contracts"]["SynthexCollateralized" + collateral.name] = {
            source: "CollateralERC20",
            constructorArguments: ["Synthex Collateralized" + collateral.name, "sxc" + collateral.symbol, collateral.address, collateral.feed, ethers.utils.parseEther(collateral.minCollateral)],
            address: collateralAddress,
        }
        console.log("Deployed collateral", collateral.name, "at", collateralAddress);
        (collaterals as any)[collateral.symbol.toLowerCase()+"c"+"Pool"] = (CollateralERC20.attach(collateralAddress));
    }

    const SynthERC20 = await ethers.getContractFactory("SynthERC20");
    dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/SynthERC20.sol/SynthERC20.json`, "utf-8");
    abi = JSON.parse(dir);
    abi = abi.abi;
    let synths = {};
    (deployments as any)["sources"]["SynthERC20"] = abi;
    for(let i = 0; i < (config as any)["synths"].length; i++) {
        let synth = (config as any)["synths"][i];
        await dManager.create("Synthex " + synth.name, "sx" + synth.symbol, synth.feed, fixedIntRate.address);
        let synthAddress = await dManager.dAssets(i);
        (deployments as any)["contracts"]["Synthex" + synth.name] = {
            source: "SynthERC20",
            constructorArguments: ["Synthex " + synth.name, "sx" + synth.symbol, synth.feed, fixedIntRate.address],
            address: synthAddress,
        }
        console.log("Deployed synth", synth.name, "at", synthAddress);
        (synths as any)[synth.symbol.toLowerCase() + "pool"] = SynthERC20.attach(synthAddress);
    }

    let rate = ethers.utils.parseUnits("0.0000000003171", 36)
    await fixedIntRate.setInterestRate(rate, "36");
    return {...synths, ...collaterals};
}