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

    let deployedContracts = await main(false, true)
    // add collateral assets
    await deployedContracts.cManager.create("Synthex Collateralized Ethereum", "sxcETH", ethers.constants.AddressZero, ethOracle.address, ethers.utils.parseEther("1"));
    const cPool = await ethers.getContractFactory("CollateralERC20");
    const ethcPool = cPool.attach(await deployedContracts.cManager.cAssets(0))

    const Pool = await ethers.getContractFactory("SynthERC20");

    // create dAssets
    // One USD
    await deployedContracts.dManager.create("One USD", "oneUSD", usdOracle.address, deployedContracts.fixedIntRate.address);
    let pool = await deployedContracts.dManager.dAssets(0);
    let usdpool = Pool.attach(pool);

    // One BTC
    await deployedContracts.dManager.create("One BTC", "oneBTC", btcOracle.address, deployedContracts.fixedIntRate.address);
    pool = await deployedContracts.dManager.dAssets(1);
    let btcpool = Pool.attach(pool);

    return { ...deployedContracts, usdpool, btcpool, ethcPool, ethOracle, usdOracle, btcOracle };
}