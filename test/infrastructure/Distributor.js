const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require('fs');

describe("Distributor", async function () {
  let owner, accounts;
  let distributor;
  const provider = await ethers.getDefaultProvider("http://localhost:8545");
  let SCALE;

  beforeEach(async () => {
    [owner, ...accounts] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");
    arbis = await TestToken.deploy();
    weth = await TestToken.deploy();
    doge = await TestToken.deploy();

    const Distributor = await ethers.getContractFactory("Distributor");
    distributor = await Distributor.deploy();

    SCALE = await distributor.SCALE();
    let ADMIN_ROLE = await distributor.ADMIN_ROLE();
    await distributor.grantRole(ADMIN_ROLE, owner.address);

  });
  
  it("setDestinations - non admin", async function () {
    await expect(distributor.connect(accounts[1]).setDestinations([], [])).to.be.revertedWith("Caller is not an admin");
  });

  it("setDestinations", async function () {
    let dests = [accounts[0].address, accounts[1].address];
    let shares = [0.75 * SCALE, 0.25 * SCALE];
    await distributor.setDestinations(dests, shares);
  });

  it("re-setDestinations", async function () {
    let dests = [accounts[0].address, accounts[1].address];
    let shares = [0.75 * SCALE, 0.25 * SCALE];
    await distributor.setDestinations(dests, shares);
    shares = [0.5 * SCALE, 0.5 * SCALE];
    await distributor.setDestinations(dests, shares);
  });


  it("e2e", async function () {
    let dests = [accounts[0].address, accounts[1].address];
    let shares = [0.75 * SCALE, 0.25 * SCALE];

    await distributor.addDistributedToken(doge.address);
    await distributor.setDestinations(dests, shares);

    let amount = ethers.utils.parseEther("100");
    await doge.transfer(distributor.address, amount);
    await weth.transfer(distributor.address, amount);

    let oldDogeBal = await doge.balanceOf(accounts[0].address);
    let oldWethBal = await weth.balanceOf(accounts[1].address);
    await distributor.distribute();
    let newDogeBal = await doge.balanceOf(accounts[0].address);
    let newWethBal = await doge.balanceOf(accounts[1].address);
    expect(newDogeBal).to.be.equal(oldDogeBal.add(ethers.utils.parseEther("75")));
    expect(newWethBal).to.be.equal(oldWethBal.add(ethers.utils.parseEther("25")));
  });
});