import { ethers } from "hardhat";
import { Liquidator } from '../typechain-types/contracts/Liquidator';
import fs from "fs";
import init from "./initiate";
const FormatTypes = ethers.utils.FormatTypes;

export default async function main(logs: boolean = true) {
  let deployments = fs.readFileSync( process.cwd() + "/deployments/goerli/deployments.json", "utf8");
  deployments = JSON.parse(deployments);
  (deployments as any)["contracts"] = {};
  (deployments as any)["sources"] = {};

  let allDeployments = await deploy(deployments, logs)
  await init(allDeployments.dManager, allDeployments.cManager, allDeployments.fixedIntRate, deployments, logs);
  
  fs.writeFileSync(process.cwd() +  "/deployments/goerli/deployments.json", JSON.stringify(deployments, null, 2));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function deploy(deployments: any = {}, logs: boolean = false) {
  const addr = await deployContract("AddressResolver", [], logs, deployments);
  const sys = await deployContract("System", [addr.address], logs, deployments);
  const reserve = await deployContract("Reserve", [sys.address], logs, deployments);
  const exchanger = await deployContract("Exchanger", [sys.address], logs, deployments);
  const dManager = await deployContract("DebtManager", [sys.address], logs, deployments);
  const cManager = await deployContract("CollateralManager", [sys.address], logs, deployments);
  const helper = await deployContract("Helper", [sys.address], logs, deployments);
  const fixedIntRate = await deployContract("FixedInterestRate", [sys.address], logs, deployments);
  const liq = await deployContract("Liquidator", [sys.address], logs, deployments);
  
  await addr.importAddresses(
    ["SYSTEM", "RESERVE", "EXCHANGER", "DEBT_MANAGER", "COLLATERAL_MANAGER", "LIQUIDATOR"].map((x) => ethers.utils.formatBytes32String(x)), 
    [sys.address, reserve.address, exchanger.address, dManager.address, cManager.address, liq.address]
  )

  return { addr, sys, reserve, exchanger, dManager, cManager, helper, fixedIntRate, liq };
}

async function deployContract(name: string, args: string[], logs: boolean = false, deployments: any = {}) {
  const Contract = await ethers.getContractFactory(name);
  const contract = await Contract.deploy(...args);
  await contract.deployed();
  if (logs) {
    console.log(name, "deployed to:", contract.address);
  }
  (deployments as any)["contracts"][name] = {
    source: name,
    constructorArguments: args,
    address: contract.address,
  };
  (deployments as any)["sources"][name] = Contract.interface.format(FormatTypes.json);
  return contract;
}