async function main() {
  const [deployer] = await ethers.getSigners();
  const nyanTokenAddress = "0xed3fb761414da74b74f33e5c5a1f78104b188dfc";

  console.log("Deploying contracts with the account:", deployer.address);

  console.log("Account balance:", (await deployer.getBalance()).toString());
  const NyanRewards = await ethers.getContractFactory("NyanRewards");
  const stakingContract = await NyanRewards.deploy(
    nyanTokenAddress, // rewardToken
    nyanTokenAddress, // stakedToken
  );

  console.log("Deployed NyanRewards at ", stakingContract.address);

  const NyanStrategy = await ethers.getContractFactory("NyanStrategy");
  const strategy = await NyanStrategy.deploy(
    stakingContract.address, // nyanToken
    nyanTokenAddress, // stakingContract
  );

  console.log("NyanStrategy ", strategy.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
