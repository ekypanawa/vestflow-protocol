const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x5E0d0146804E6c34f748CED382C5ee179aFb3A5E";
  const recipient = "0xd564ab77aDE8D2a4f3199d71f4Aa9F487976d63C";

  const vestFlow = await ethers.getContractAt("VestFlow", contractAddress);

  const tx = await vestFlow.createVault(
    recipient,
    0,
    60,
    "OPN Builders Demo Vault",
    { value: ethers.parseEther("0.001") }
  );

  console.log("Create vault tx:", tx.hash);
  await tx.wait();
  console.log("Demo vault created successfully.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
