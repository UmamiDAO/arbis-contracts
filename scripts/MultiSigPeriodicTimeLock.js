const getUnixTime = require('date-fns/getUnixTime')
const parseISO = require('date-fns/parseISO')

async function main() {
  const [deployer] = await ethers.getSigners();

  const ARBIS = "0x9f20de1fc9b161b34089cbeae888168b44b03461";
  const beneficiary = "0xE2A06daDfcb0007855224F6f63CB34e2E6be0d6C";
  const signatories = [ 
    "0x2186107D6d3692bd9ef592001C78777bF34b672e", // luffy
    "0x54501d756F4fAbBD6d75D21fEC6f9349626f9a8e", // picky
    "0xE2A06daDfcb0007855224F6f63CB34e2E6be0d6C", // puffy
    "0x0C0512D19577763F1de55f75B33aD74A275225d5", // pinky
    "kianaxbt.eth"                                // kiana
  ] 
  const twoWeeks = 60 * 60 * 24 * 14;
  const MultiSigPeriodicTimeLock = await ethers.getContractFactory("MultiSigPeriodicTimeLock");
  const timelock = await MultiSigPeriodicTimeLock.deploy(ARBIS, beneficiary, twoWeeks, signatories);
  console.log("Timelock address:", timelock.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
