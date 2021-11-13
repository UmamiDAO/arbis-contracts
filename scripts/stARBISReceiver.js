async function main() {
  const [deployer] = await ethers.getSigners();

  const stARBIS = "0xBf00759D7E329d7A7fa1D4DCdC914C53d1d2db86";
  const factory = await ethers.getContractFactory("stARBISReceiver");
  const contract = await factory.deploy(stARBIS);
  console.log("stARBISReceiver deployed at ", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
