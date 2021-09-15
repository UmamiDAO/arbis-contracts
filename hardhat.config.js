require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
const { expect } = require("chai");

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

task("deploy-sushi-farm", "Deploys a new Sushi farm strategy")
  .addParam("name", "The farm name, e.g. \"Arbi's Sushi USDC/ETH LP Farm Shares\"")
  .addParam("symbol", "The farm symbol")
  .addParam("depositToken", "The SLP deposit token address")
  .addParam("pid", "The farm ID")
  .addParam(
    "factory", 
    "The SushiLPFarmStrategyFactory address", 
    "0xaE598cE4982103Ad994f4A368DBD5F8b8b11b9fB",
  )
  .addParam(
    "stakingContract", 
    "The staking contract address", 
    "0xF4d73326C13a4Fc5FD7A064217e12780e9Bd62c3",
  )
  .addParam(
    "router",
    "The SushiSwapV2 router address",
    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
  )
  .setAction(async (taskArgs, hre) => {
    console.log("Creating farm with params: ", taskArgs);

    const sushiToken = "0xd4d42F0b6DEF4CE0383636770eF773390d85c61A";

    const SushiLPFarmStrategyFactory = await ethers.getContractFactory("SushiLPFarmStrategyFactory");
    const factory = await SushiLPFarmStrategyFactory.attach(taskArgs.factory);

    const numFarms = await factory.farmsCount();

    await factory.addFarm(
      taskArgs.name,
      taskArgs.symbol,
      taskArgs.depositToken,
      sushiToken,
      taskArgs.stakingContract,
      taskArgs.router,
      taskArgs.pid
    );

    const newNumFarms = await factory.farmsCount();
    expect(newNumFarms, "Farm wasn't added").to.equal(numFarms + 1);

    const farmAddr = await factory.farms(newNumFarms - 1);
    console.log("Strategy deployed at ", farmAddr);
  });

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: "0.8.4",
  networks: {
    hardhat: {
      initialBaseFeePerGas: 0, // workaround from https://github.com/sc-forks/solidity-coverage/issues/652#issuecomment-896330136 . Remove when that issue is closed.
    },
    arbitrum_rinkeby: {
      url: process.env.ARBITRUM_RINKEBY_URL,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    arbitrum_mainnet: {
      url: process.env.ARBITRUM_MAINNET_URL,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
