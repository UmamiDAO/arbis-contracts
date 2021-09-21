const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require('fs');

describe("MultiSigTimeLock", async function () {
  let owner, accounts;
  let timelock;
  let arbis;

  const twoWeeks = 60 * 60 * 24 * 14;
  const provider = await ethers.getDefaultProvider("http://localhost:8545");

  beforeEach(async () => {
    [owner, ...accounts] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");
    arbis = await TestToken.deploy();

    const MultiSigTimeLock = await ethers.getContractFactory("MultiSigPeriodicTimeLock");
    timelock = await MultiSigTimeLock.deploy(
      arbis.address, 
      owner.address,
      twoWeeks,
      [accounts[0].address, accounts[1].address, accounts[2].address, accounts[3].address]
    );

    await arbis.transfer(timelock.address, ethers.utils.parseEther("1000000"));
  });
  
  it("Non-signatory - lock", async function () {
    await expect(timelock.lock()).to.be.revertedWith("Not signatory");
  });

  it("Non-signatory - approve", async function () {
    await expect(timelock.approve(0)).to.be.revertedWith("Not signatory");
  });

  it("Non-signatory - setBeneficiary", async function () {
    await expect(timelock.setBeneficiary(owner.address)).to.be.revertedWith("Not signatory");
  });

  it("Non-signatory - release", async function () {
    await expect(timelock.release()).to.be.revertedWith("Not signatory");
  });

  it("Signatory - lock before time", async function () {
    await expect(timelock.connect(accounts[0]).lock()).to.be.revertedWith("Current time is before release time");
  });

  it("Signatory - release before time", async function () {
    await expect(timelock.connect(accounts[0]).release()).to.be.revertedWith("Current time is before release time");
  });

  it("setBenificiary", async function () {
    for (let i = 0; i < 4; i++) {
      await timelock.connect(accounts[i]).approve(1);
    }
    let beneficiary = await timelock.beneficiary();
    expect(beneficiary).to.be.equal(owner.address);

    await timelock.connect(accounts[0]).setBeneficiary(accounts[0].address);

    beneficiary = await timelock.beneficiary();
    expect(beneficiary).to.be.equal(accounts[0].address);
  });

  it("setBenificiary - reset approvals", async function () {
    for (let i = 0; i < 4; i++) {
      await timelock.connect(accounts[i]).approve(1);
    }
    await timelock.connect(accounts[0]).setBeneficiary(accounts[0].address);
    await expect(timelock.connect(accounts[0]).setBeneficiary(accounts[0].address)).to.be.revertedWith("Signatory has not approved");
  });

  it("release early", async function () {
    for (let i = 0; i < 4; i++) {
      await timelock.connect(accounts[i]).approve(0);
    }
    await expect(timelock.connect(accounts[0]).release()).to.be.revertedWith("Current time is before release time");
  });

  it("release", async function () {
    let tx;
    for (let i = 0; i < 4; i++) {
      tx = await timelock.connect(accounts[i]).approve(0);
    }

    // Fast forward
    const delay = 60 * 60 * 24 * 14;
    const timestampBefore = (await provider.getBlock(tx.blockNumber)).timestamp;
    await network.provider.send("evm_setNextBlockTimestamp", [timestampBefore + delay]);
    await network.provider.send("evm_mine");

    let beneficiary = await timelock.beneficiary();
    let beneficiaryBal = await arbis.balanceOf(beneficiary);

    await timelock.connect(accounts[0]).release();

    let newBeneficiaryBal = await arbis.balanceOf(beneficiary);

    expect(newBeneficiaryBal).to.be.equal(beneficiaryBal.add(ethers.utils.parseEther("1000000")));
  });
});