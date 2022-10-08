import { ethers } from "hardhat";
import hre from "hardhat";

import fs from "fs";
import initiate from "./initiate";
import { Contract } from 'ethers';
const FormatTypes = ethers.utils.FormatTypes;

export interface Deployments {
  addr: Contract;
  sys: Contract;
  reserve: Contract;
  dManager: Contract;
  cManager: Contract;
  helper: Contract;
  fixedIntRate: Contract;
  liq: Contract;
}

export default async function main(logs: boolean = true, test: boolean = false) {
  let deployments = fs.readFileSync( process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, "utf8");
  deployments = JSON.parse(deployments);
  (deployments as any)["contracts"] = {};
  (deployments as any)["sources"] = {};

  let allDeployments = await deploy(deployments, logs)
  let synths = {}
  synths = await initiate(allDeployments, deployments, logs);
  
  fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
  return {...allDeployments, ...synths};
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function deploy(deployments: any = {}, logs: boolean = false): Promise<Deployments> {
  const addr = await deployContract("AddressResolver", [], logs, deployments);
  const sys = await deployContract("System", [addr.address, ethers.utils.parseEther("1.3").toString(), ethers.utils.parseEther("2.0").toString()], logs, deployments);
  const reserve = await deployContract("Reserve", [sys.address], logs, deployments);
  const dManager = await deployContract("DebtManager", [sys.address], logs, deployments);
  const cManager = await deployContract("CollateralManager", [sys.address], logs, deployments);
  const helper = await deployContract("Helper", [sys.address], logs, deployments);
  const fixedIntRate = await deployContract("FixedInterestRate", [sys.address], logs, deployments);
  const liq = await deployContract("Liquidator", [sys.address], logs, deployments);

  await addr.importAddresses(
    ["SYSTEM", "RESERVE", "DEBT_MANAGER", "COLLATERAL_MANAGER", "LIQUIDATOR"].map((x) => ethers.utils.formatBytes32String(x)), 
    [sys.address, reserve.address, dManager.address, cManager.address, liq.address]
  )

  return { addr, sys, reserve, dManager, cManager, helper, fixedIntRate, liq };
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
  const dir = fs.readFileSync(process.cwd() + `/artifacts/contracts/${name}.sol/${name}.json`, "utf-8");
  let abi = JSON.parse(dir)
  abi = abi.abi;
  (deployments as any)["sources"][name] = abi;
  return contract;
}