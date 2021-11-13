const { ethers } = require("hardhat");
async function main() {
 // const [deployer] = await ethers.getSigners();

  const RINKEBY_ARBIS = "0xD1005165AD5a77Abb85312963E9Fd17A0a5ff860";
  const ARBIS = "0x9f20de1fc9b161b34089cbeae888168b44b03461";
  const ARBISETHLP = "0xa32329952c857fbc707b4d2ad5901ddb93bfef9f";
  const STARBISETHLP = "0xEf1F3f33F5f09A6bfDeE4FC7f226409F19276F16";
  const stARBIS = await ethers.getContractFactory("stARBIS");
  const contract = await stARBIS.deploy(ARBISETHLP);
  contract.addApprovedRewardToken("0xdb96f8efd6865644993505318cc08ff9c42fb9ac");//Z2O
  console.log("stARBIS deployed at ", contract.address);
  const stARBISReceiver = await ethers.getContractFactory("stARBISReceiver");
  const receiver = await stARBISReceiver.deploy(contract.address);
  console.log("stARBISReceiver deployed at ", receiver.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
