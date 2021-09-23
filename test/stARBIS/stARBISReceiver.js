const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require('fs');

describe("stARBIS", async function () {
  let owner;
  let stARBIS;
  let weth;
  let SCALE;
  let receiver;
  let starbis;
  const provider = await ethers.getDefaultProvider("http://localhost:8545");

  beforeEach(async () => {
    [owner, ...accounts] = await ethers.getSigners();
    
    const TestToken = await ethers.getContractFactory("TestToken");
    weth = await TestToken.deploy();
    arbis = await TestToken.deploy();

    const stARBIS = await ethers.getContractFactory("stARBIS");
    starbis = await stARBIS.deploy(arbis.address);

    
    const stARBISReceiver = await ethers.getContractFactory("stARBISReceiver");
    receiver = await stARBISReceiver.deploy(starbis.address);

    let adminRole = await receiver.ADMIN_ROLE();
    await starbis.grantRole(adminRole, owner.address);
    await receiver.grantRole(adminRole, owner.address);

    await starbis.addApprovedRewardToken(weth.address);
  });
  
  it("sendBalancesAsRewards", async function () {
    let amount = ethers.utils.parseEther("100");
    await weth.transfer(receiver.address, amount);
    await receiver.addDistributedToken(weth.address);
    await receiver.sendBalancesAsRewards();
    let stBal = await weth.balanceOf(starbis.address);
    expect(stBal, "stARBIS didn't receive tokens").to.be.equal(amount);
  });
});