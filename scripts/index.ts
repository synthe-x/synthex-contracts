import { ethers } from "hardhat";

export default async function main() {
  const AddressResolver = await ethers.getContractFactory("AddressResolver");
  const addr = await AddressResolver.deploy();
  await addr.deployed();

  const System = await ethers.getContractFactory("System");
  const sys = await System.deploy(addr.address);
  await sys.deployed();

  const Reserve = await ethers.getContractFactory("Reserve");
  const reserve = await Reserve.deploy((sys as any).address);
  await reserve.deployed();

  const Exchanger = await ethers.getContractFactory("Exchanger");
  const exchanger = await Exchanger.deploy(sys.address);
  await exchanger.deployed();

  const DebtManager = await ethers.getContractFactory("DebtManager");
  const dManager = await DebtManager.deploy(sys.address);
  await dManager.deployed();

  const CollateralManager = await ethers.getContractFactory("CollateralManager");
  const cManager = await CollateralManager.deploy(sys.address);
  await cManager.deployed();

  const Helper = await ethers.getContractFactory("Helper");
  const helper = await Helper.deploy(sys.address);
  await helper.deployed();

  const FixedInterestRate = await ethers.getContractFactory("FixedInterestRate");
  const fixedIntRate = await FixedInterestRate.deploy(sys.address);
  await fixedIntRate.deployed();

  await addr.importAddresses(
    ["SYSTEM", "RESERVE", "EXCHANGER", "DEBT_MANAGER", "COLLATERAL_MANAGER"].map((x) => ethers.utils.formatBytes32String(x)), 
    [sys.address, reserve.address, exchanger.address, dManager.address, cManager.address]
  )

  return { addr, sys, reserve, exchanger, dManager, cManager, helper, fixedIntRate };
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
