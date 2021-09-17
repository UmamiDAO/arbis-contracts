const { ethers } = require("ethers");

async function main() {
  const [deployer] = await ethers.getSigners();

  const ARBIS = "0x9f20de1fc9b161b34089cbeae888168b44b03461";
  const stARBIS = await ethers.getContractFactory("stARBIS");
  const contract = stARBIS.deploy(ARBIS);
  console.log("stARBIS deployed at ", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
