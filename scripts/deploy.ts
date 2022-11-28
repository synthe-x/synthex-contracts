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
  fixedIntRate: Contract;
  liq: Contract;
  helper: Contract;
  limit: Contract;
}

export interface Synths {
  usdpool: Contract;
  ethpool: Contract;
  btcpool: Contract;
  weth: Contract;
}

export default async function deploy(logs: boolean = true, test: boolean = false) {
  let deployments = fs.readFileSync( process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, "utf8");
  deployments = JSON.parse(deployments);
  (deployments as any)["contracts"] = {};
  (deployments as any)["sources"] = {};

  let allDeployments = await deployMain(deployments, logs)
  let synths: Synths|{} = {}
  synths = await initiate(allDeployments, deployments, logs);
  
  fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
  return {...allDeployments, ...synths};
}

async function deployMain(deployments: any, logs: boolean = false): Promise<Deployments> {
  const addr = await deployContract("AddressResolver", [], logs, deployments);
  const sys = await deployContract("System", [addr.address, ethers.utils.parseEther("1.3").toString(), ethers.utils.parseEther("2.0").toString()], logs, deployments);
  const reserve = await deployContract("Reserve", [sys.address], logs, deployments);
  const helper = await deployContract("Helper", [], logs, deployments);
  const dManager = await deployContract("DebtManager", [sys.address], logs, deployments);
  const cManager = await deployContract("CollateralManager", [sys.address], logs, deployments);
  const fixedIntRate = await deployContract("FixedInterestRate", [sys.address], logs, deployments);
  const liq = await deployContract("Liquidator", [sys.address], logs, deployments);
  const limit = await deployContract("LimitOrder", [sys.address], logs, deployments);

  const settup = async () => {
    console.log('Setting interest rate')
    await fixedIntRate.setInterestRate("21979553066");
    console.log('Setting addresses')
    await addr.importAddresses(
      ['SYSTEM', 'RESERVE', 'DEBT_MANAGER', 'COLLATERAL_MANAGER', 'LIQUIDATOR', 'LIMIT_ORDER'].map((x) => ethers.utils.formatBytes32String(x)), 
      [sys.address, reserve.address, dManager.address, cManager.address, liq.address, limit.address]
    )
  }

  try{
    await settup();
  } catch (err) {
    console.log('errxx', err);
    await settup();
  }

  return { addr, sys, reserve, dManager, cManager, fixedIntRate, liq, helper, limit };
}

async function deployContract(name: string, args: string[], logs: boolean = false, deployments: any = {}, override = true) {
  const Contract = await ethers.getContractFactory(name);
  let contract;
  if(override && deployments['contracts'][name]){
    contract = Contract.attach(deployments['contracts'][name].address);
  } else {
    try{
      contract = await Contract.deploy(...args);
    }
    catch(err){
      console.log('errorxx', err)
      contract = await Contract.deploy(...args);
    }
    await contract.deployed();
  }
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
  fs.writeFileSync(process.cwd() +  `/deployments/${hre.network.name}/deployments.json`, JSON.stringify(deployments, null, 2));
  return contract;
}