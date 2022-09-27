import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    hardhat: {
      chainId: 1337,
      blockGasLimit: 1000000000,
      allowUnlimitedContractSize: true,
      // forking: {
      //   url: "https://goerli.infura.io/v3/bb621c9372d048979f8677ba78fe41d7"
      // },
    },
  },
};

export default config;
