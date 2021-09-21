async function main() {
  const [deployer] = await ethers.getSigners();
  const TestToken = await ethers.getContractFactory("TestToken");
  const token = await TestToken.deploy()
  console.log("Token deployed at ", token.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
