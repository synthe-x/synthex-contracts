import main from ".."

// return { addr, sys, reserve, exchanger, dManager, cManager, helper, fixedIntRate, liq };
import {ethers} from "hardhat";

export default async function _main () {
    const PriceOracle = await ethers.getContractFactory("MockPriceOracle");
    const usdOracle = await PriceOracle.deploy();
    await usdOracle.setPrice("100000000")

    const btcOracle = await PriceOracle.deploy();
    await btcOracle.setPrice("2000000000000")

    const ethOracle = await PriceOracle.deploy();
    await ethOracle.setPrice("100000000000")

    let deployedContracts = await main(false)
    // add collateral assets
    await deployedContracts.cManager.addCollateralAsset(ethers.constants.AddressZero, ethOracle.address);

    const Pool = await ethers.getContractFactory("SynthERC20");

    // create dAssets
    // One USD
    await deployedContracts.dManager.create("One USD", "oneUSD");
    let pool = await deployedContracts.dManager.dAssets(0);

    let usdpool = Pool.attach(pool);
    await usdpool.setPriceOracle(usdOracle.address);
    await usdpool.setInterestRate(deployedContracts.fixedIntRate.address);

    // One BTC
    await deployedContracts.dManager.create("One BTC", "oneBTC");
    pool = await deployedContracts.dManager.dAssets(1);

    let btcpool = Pool.attach(pool);
    await btcpool.setPriceOracle(btcOracle.address);
    await btcpool.setInterestRate(deployedContracts.fixedIntRate.address);

    return { ...deployedContracts, usdpool, btcpool };
}