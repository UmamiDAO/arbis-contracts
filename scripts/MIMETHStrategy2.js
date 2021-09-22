async function main() {
    const [deployer] = await ethers.getSigners();
  
    const lpDepositToken = "0xb6DD51D5425861C808Fd60827Ab6CFBfFE604959";
    const SUSHI = "0xd4d42f0b6def4ce0383636770ef773390d85c61a";
    const  SPELL = "0x3e6648c5a70a150a88bce65f4ad4d506fe15d2af";
    const stakingContract = "0xF4d73326C13a4Fc5FD7A064217e12780e9Bd62c3";
    const router = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
    const name = "Arbis Sushi MIM/ETH LP Farm Shares 2";
    const symbol = "MIM/ETH-SHARES-2";
    const pid = 9;
    const MIMETHStrategy2 = await ethers.getContractFactory("MIMETHStrategy2");
    const contract = await MIMETHStrategy2.deploy(name, symbol, lpDepositToken, SUSHI, SPELL, stakingContract, router, pid);
    console.log("MIMETHStrategy2 deployed at ", contract.address);
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
  