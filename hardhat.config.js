require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const OPN_RPC_URL = process.env.OPN_RPC_URL || "https://testnet-rpc.iopn.tech";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    opnTestnet: {
      url: OPN_RPC_URL,
      chainId: 984,
      gasPrice: 7000000000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []
    }
  }
};
