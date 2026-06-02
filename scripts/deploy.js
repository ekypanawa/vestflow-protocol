const hre = require("hardhat");

async function main() {
  const VestFlow = await hre.ethers.getContractFactory("VestFlow");
  const vestFlow = await VestFlow.deploy();
  await vestFlow.waitForDeployment();

  const address = await vestFlow.getAddress();
  const txHash = vestFlow.deploymentTransaction().hash;

  console.log("VestFlow Protocol deployed to:", address);
  console.log("Deployment transaction hash:", txHash);
  console.log("Explorer:", `https://testnet.iopn.tech/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
