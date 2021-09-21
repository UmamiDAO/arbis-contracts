async function main() {
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractFactory("ARBIS");
  const contract = await factory.deploy();
  console.log("ARBIS deployed at ", contract.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
