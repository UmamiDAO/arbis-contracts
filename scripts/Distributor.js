async function main() {
  const [deployer] = await ethers.getSigners();

  const Distributor = await ethers.getContractFactory("Distributor");
  const distributor = await Distributor.deploy("Fee Distributor");
  console.log("Distributor deployed at ", distributor.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
