const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require('fs');
const { format } = require("path");

const SCALE = 1e8;

describe("stARBIS", async function () {
  let owner, addr1, addr2, addr3, addr4;
  let stARBIS;
  let stakeToken;
  let accounts;

  const provider = await ethers.getDefaultProvider("http://localhost:8545");

  async function printTokenBalance(token, address) {
    let balance = await token.balanceOf(address);
    console.log(`token balance for ${address} is ${ethers.utils.formatEther(balance)}`);
  }

  function listenForContractEvents(contract, eventName) {
    return new Promise((resolve, reject) => {
        contract.once(eventName, (...args) => {
          const event = args[args.length - 1];
          event.removeListener();
          resolve(event);
        });
        setTimeout(() => {
          reject(new Error('timeout'));
        }, 60000)
    });
  }

  beforeEach(async () => {
    [owner, ...accounts] = await ethers.getSigners();

    const TestToken = await ethers.getContractFactory("TestToken");
    stakeToken = await TestToken.deploy();
    weth = await TestToken.deploy();
    doge = await TestToken.deploy();

    const factory = await ethers.getContractFactory("stARBIS");
    stARBIS = await factory.deploy(stakeToken.address);

    // Transfer first five addresses some tokens
    for (let i = 0; i < 5; i++) {
      await stakeToken.transfer(accounts[i].address, ethers.utils.parseEther("2000"));
      await doge.transfer(accounts[i].address, ethers.utils.parseEther("2000"));
      await weth.transfer(accounts[i].address, ethers.utils.parseEther("2000"));
    }

    let adminRole = await stARBIS.ADMIN_ROLE();
    await stARBIS.grantRole(adminRole, owner.address);

    await stARBIS.addApprovedRewardToken(weth.address);
  });
  
  it("Add reward - unapproved token", async function () {
    let amount = ethers.utils.parseEther("1");
    await expect(stARBIS.addReward(doge.address, amount)).to.be.revertedWith("Token is not approved for rewards");
  });

  it("Add reward - unapproved token 2", async function () {
    let amount = ethers.utils.parseEther("1");
    await stARBIS.addApprovedRewardToken(doge.address);
    await doge.approve(stARBIS.address, amount);
    await stARBIS.removeApprovedRewardToken(doge.address);
    await expect(stARBIS.addReward(doge.address, amount)).to.be.revertedWith("Token is not approved for rewards");
  });

  it("Add reward - approved token", async function () {
    let amount = ethers.utils.parseEther("1");
    await stARBIS.addApprovedRewardToken(doge.address);
    await doge.approve(stARBIS.address, amount);
    await stARBIS.addReward(doge.address, amount);
    let dogeApproved = await stARBIS.isApprovedRewardToken(doge.address);
    expect(dogeApproved, "Token not approved").to.be.true;
  });

  it("Staking - token transfer", async function () {
    let amount = ethers.utils.parseEther("150");
    await stakeToken.approve(stARBIS.address, amount);
    let before = await stakeToken.balanceOf(owner.address);
    await stARBIS.stake(amount);
    let after = await stakeToken.balanceOf(owner.address);
    expect(after, "ARBIS weren't transferred ").to.equal(before.sub(amount));

    let contractBalance = await stakeToken.balanceOf(stARBIS.address);
    expect(contractBalance, "stARBIS weren't received").to.equal(amount);
  });

  it("Staking - getNumberOfStakeholders", async function () {
    let amount = ethers.utils.parseEther("150");
    let numStakers = await stARBIS.getNumberOfStakeholders();
    expect(numStakers, "Phantom stakers").to.be.equal(0);

    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);

    numStakers = await stARBIS.getNumberOfStakeholders();
    expect(numStakers, "Incorrect number of stakers").to.be.equal(1);

    await stakeToken.connect(accounts[3]).approve(stARBIS.address, amount);
    await stARBIS.connect(accounts[3]).stake(amount);

    numStakers = await stARBIS.getNumberOfStakeholders();
    expect(numStakers, "Incorrect number of stakers").to.be.equal(2);


    let s1 = await stARBIS.stakeholders(0);
    let s2 = await stARBIS.stakeholders(1);
    expect(s1).to.be.equal(owner.address);
    expect(s2).to.be.equal(accounts[3].address);

    await stARBIS.connect(accounts[3]).withdraw(amount);

    numStakers = await stARBIS.getNumberOfStakeholders();
    expect(numStakers, "Incorrect number of stakers").to.be.equal(1);

    await stARBIS.withdraw(amount);

    numStakers = await stARBIS.getNumberOfStakeholders();
    expect(numStakers, "Incorrect number of stakers").to.be.equal(0);
  });

  it("Staking - stake stARBIS mint", async function () {
    let amount = ethers.utils.parseEther("150");
    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);
    let balance = await stARBIS.balanceOf(owner.address);
    expect(balance, "stARBIS weren't minted").to.equal(amount);
  });

  it("Withdrawal", async function () {
    let amount = ethers.utils.parseEther("150");
    let oldBal = await stakeToken.balanceOf(owner.address);
    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);
    await stARBIS.withdraw(amount);
    let newBal = await stakeToken.balanceOf(owner.address);
    expect(newBal, "Didn't get ARBIS back").to.equal(oldBal);

    let stBal = await stARBIS.balanceOf(owner.address);
    expect(stBal, "stARBIS weren't burnt").to.equal(ethers.utils.parseEther("0"));
  });

  it("Rewards - multiple reward tokens", async function () {
    let amount1 = ethers.utils.parseEther("150");
    let amount2 = ethers.utils.parseEther("666");
    // Stake
    await stakeToken.approve(stARBIS.address, amount1);
    await stARBIS.stake(amount1);

    let wethBal = await weth.balanceOf(owner.address);
    let dogeBal = await doge.balanceOf(owner.address);

    // Doge reward
    await stARBIS.addApprovedRewardToken(doge.address);
    await doge.connect(accounts[2]).approve(stARBIS.address, amount1);
    await stARBIS.connect(accounts[2]).addReward(doge.address, amount1);

    // Weth reward
    await weth.connect(accounts[2]).approve(stARBIS.address, amount2);
    await stARBIS.connect(accounts[2]).addReward(weth.address, amount2);

    await stARBIS.collectRewards();

    let newWethBal = await weth.balanceOf(owner.address);
    let newDogeBal = await doge.balanceOf(owner.address);

    expect(newDogeBal, "Didn't get DOGE back").to.equal(dogeBal.add(amount1));
    expect(newWethBal, "Didn't get WETH back").to.equal(wethBal.add(amount2));
  });

  it("Rewards - excessTokenRewards", async function () {
    let amount = ethers.utils.parseEther("1");
    // Add weth reward
    await weth.connect(accounts[4]).approve(stARBIS.address, amount);
    await stARBIS.connect(accounts[4]).addReward(weth.address, amount);
    let oldBal = await weth.balanceOf(owner.address);

    // Stake and withdraw
    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);
    await stARBIS.withdraw(amount);

    // Ensure we didn't receive weth
    let newBal = await weth.balanceOf(owner.address);
    expect(newBal, "Got unwarranted rewards back").to.equal(oldBal);
    let excess = await stARBIS.excessTokenRewards(weth.address);
    expect(excess, "excessTokenRewards wasn't updated properly").to.equal(amount);

    // Ensure we did receive weth
    await stARBIS.withdrawExcessRewards();
    let bal = await weth.balanceOf(owner.address);
    expect(bal, "Didn't receive excess rewards").to.equal(oldBal.add(amount));
  });

  it("Rewards - getAvailableTokenRewards", async function () {
    let amount1 = ethers.utils.parseEther("150");
    let amount2 = ethers.utils.parseEther("666");

    // Stake
    await stakeToken.approve(stARBIS.address, amount1);
    await stARBIS.stake(amount1);

    // Doge reward
    await stARBIS.addApprovedRewardToken(doge.address);
    await doge.connect(accounts[2]).approve(stARBIS.address, amount1);
    await stARBIS.connect(accounts[2]).addReward(doge.address, amount1);

    // Weth reward
    await weth.connect(accounts[2]).approve(stARBIS.address, amount2);
    await stARBIS.connect(accounts[2]).addReward(weth.address, amount2);

    let wethAvail = await stARBIS.getAvailableTokenRewards(weth.address);
    let dogeAvail = await stARBIS.getAvailableTokenRewards(doge.address);

    expect(dogeAvail, "Incorrect DOGE available").to.equal(amount1);
    expect(wethAvail, "Incorrect WETH available").to.equal(amount2);
  });

  it("Fees - earlyWithdrawal with fee - redistribution", async function () {
    const sevenDays = 60 * 60 * 24 * 7;
    await stARBIS.setEarlyWithdrawalSecondsThreshold(sevenDays);
    await stARBIS.setEarlyWithdrawalFee(0.3*SCALE);
    await stARBIS.setEarlyWithdrawalDistributeShare(0.166666*SCALE); // 5% of original amount

    let amount = ethers.utils.parseEther("150");
    let oldBal = await stakeToken.balanceOf(owner.address);
    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);
    await stARBIS.withdraw(amount);
    let newBal = await stakeToken.balanceOf(owner.address);
    expect(newBal, "Expected fee wasn't taken").to.be.closeTo(oldBal.sub(ethers.utils.parseEther("45")), ethers.utils.parseEther("0.01"));
  });

  it("Fees - earlyWithdrawal with fee - receive", async function () {
    const sevenDays = 60 * 60 * 24 * 7;
    await stARBIS.setEarlyWithdrawalSecondsThreshold(sevenDays);
    await stARBIS.setEarlyWithdrawalFee(0.3*SCALE);
    await stARBIS.setEarlyWithdrawalDistributeShare(0.5*SCALE); // 50% of 30% fee is redistributed
    await stARBIS.setFeeDestination(accounts[3].address);

    let oldBal = await stakeToken.balanceOf(accounts[3].address);

    let amount = ethers.utils.parseEther("150");
    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);
    await stARBIS.withdraw(amount);


    let newBal = await stakeToken.balanceOf(accounts[3].address);
    expect(newBal, "Fee wasn't received").to.be.closeTo(oldBal.add(ethers.utils.parseEther("22.5")), ethers.utils.parseEther("0.0001"));
  });

  it("Fees - earlyWithdrawal with fee - 1", async function () {
    const sevenDays = 60 * 60 * 24 * 7;
    await stARBIS.setEarlyWithdrawalSecondsThreshold(sevenDays);
    await stARBIS.setEarlyWithdrawalFee(0.3*SCALE);
    await stARBIS.setEarlyWithdrawalDistributeShare(0.166666*SCALE); // 5% of original amount

    let amount = ethers.utils.parseEther("150");
    let oldBal = await stakeToken.balanceOf(owner.address);
    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);
    await stARBIS.withdraw(amount);
    let newBal = await stakeToken.balanceOf(owner.address);
    expect(newBal, "Expected fee wasn't taken").to.be.closeTo(oldBal.sub(ethers.utils.parseEther("45")), ethers.utils.parseEther("0.01"));
  });

  it("Fees - earlyWithdrawal with fee - 2", async function () {
    const sevenDays = 60 * 60 * 24 * 7;
    await stARBIS.setEarlyWithdrawalSecondsThreshold(sevenDays);
    await stARBIS.setEarlyWithdrawalFee(0.3*SCALE);
    await stARBIS.setEarlyWithdrawalDistributeShare(0.166666*SCALE); // 5% of original amount

    let amount = ethers.utils.parseEther("150");
    let oldBal = await stakeToken.balanceOf(owner.address);
    await stakeToken.approve(stARBIS.address, amount);
    let tx = await stARBIS.stake(amount);

    // Fast forward 4.5 days so we get 50% max fee
    const blockBefore = await provider.getBlock(tx.blockNumber);
    const timestampBefore = blockBefore.timestamp;
    await network.provider.send("evm_setNextBlockTimestamp", [Math.floor(timestampBefore + sevenDays*0.5)]);
    await network.provider.send("evm_mine");
    
    await stARBIS.withdraw(amount);
    let newBal = await stakeToken.balanceOf(owner.address);
    expect(newBal, "Expected fee wasn't taken").to.be.closeTo(oldBal.sub(ethers.utils.parseEther("22.5")), ethers.utils.parseEther("0.01"));
  });

  it("Fees - earlyWithdrawal with fee - 3", async function () {
    const sevenDays = 60 * 60 * 24 * 7;
    await stARBIS.setEarlyWithdrawalSecondsThreshold(sevenDays);
    await stARBIS.setEarlyWithdrawalFee(0.3*SCALE);
    await stARBIS.setEarlyWithdrawalDistributeShare(0.166666*SCALE);

    let amount = ethers.utils.parseEther("150");
    let oldBal = await stakeToken.balanceOf(owner.address);
    await stakeToken.approve(stARBIS.address, amount);
    let tx = await stARBIS.stake(amount);

    // Fast forward 4.5 days so we get 50% max fee
    const blockBefore = await provider.getBlock(tx.blockNumber);
    const timestampBefore = blockBefore.timestamp;
    await network.provider.send("evm_setNextBlockTimestamp", [Math.floor(timestampBefore + sevenDays*0.75)]);
    await network.provider.send("evm_mine");
    
    await stARBIS.withdraw(amount);
    let newBal = await stakeToken.balanceOf(owner.address);
    expect(newBal, "Expected fee wasn't taken").to.be.closeTo(oldBal.sub(ethers.utils.parseEther("11.25")), ethers.utils.parseEther("0.01"));
  });

  it("Fees - earlyWithdrawal with fee - 4", async function () {
    const sevenDays = 60 * 60 * 24 * 7;
    await stARBIS.setEarlyWithdrawalSecondsThreshold(sevenDays);
    await stARBIS.setEarlyWithdrawalFee(0.3*SCALE);
    await stARBIS.setEarlyWithdrawalDistributeShare(0.166666*SCALE);

    let amount = ethers.utils.parseEther("150");
    let oldBal = await stakeToken.balanceOf(owner.address);
    await stakeToken.approve(stARBIS.address, amount);
    let tx = await stARBIS.stake(amount);

    // Fast forward 4.5 days so we get 50% max fee
    const blockBefore = await provider.getBlock(tx.blockNumber);
    const timestampBefore = blockBefore.timestamp;
    await network.provider.send("evm_setNextBlockTimestamp", [Math.floor(timestampBefore + sevenDays*0.25)]);
    await network.provider.send("evm_mine");
    
    await stARBIS.withdraw(amount);
    let newBal = await stakeToken.balanceOf(owner.address);
    expect(newBal, "Expected fee wasn't taken").to.be.closeTo(oldBal.sub(ethers.utils.parseEther("33.75")), ethers.utils.parseEther("0.01"));
  });

  it("Fees - withdraw gas fee", async function () {
    let amount = ethers.utils.parseEther("150");
    await stakeToken.approve(stARBIS.address, amount.mul(3));
    await stARBIS.stake(amount);
    await stARBIS.stake(amount);
    await stARBIS.stake(amount);
    let gas = await stARBIS.estimateGas.withdraw(amount);
    console.log("Gas fee: ", gas.toString());
  });

  it("Fees - earlyWithdrawal without fee", async function () {
    const sevenDays = 60 * 60 * 24 * 7;
    await stARBIS.setEarlyWithdrawalSecondsThreshold(sevenDays);
    await stARBIS.setEarlyWithdrawalFee(0.3*SCALE);
    await stARBIS.setEarlyWithdrawalDistributeShare(0.166666*SCALE);

    let oldBal = await stakeToken.balanceOf(owner.address);

    // None of this should be eligible for fee
    let amount = ethers.utils.parseEther("200");
    await stakeToken.approve(stARBIS.address, amount);
    let tx = await stARBIS.stake(amount);

    // Fast forward time
    const blockBefore = await provider.getBlock(tx.blockNumber);
    const timestampBefore = blockBefore.timestamp;
    await network.provider.send("evm_setNextBlockTimestamp", [timestampBefore + sevenDays + 30]);
    await network.provider.send("evm_mine");
    
    await stARBIS.withdraw(amount);
    let newBal = await stakeToken.balanceOf(owner.address);
    expect(newBal, "Unexpected fee").to.equal(oldBal);
  });

  it("Fees - invalid grantAdmin", async function () {
    let adminRole = await stARBIS.ADMIN_ROLE();
    await expect(
      stARBIS.connect(accounts[10]).grantRole(adminRole, accounts[10].address)
    ).to.be.revertedWith("is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  async function getRewardEventFromBlock(blockNumber, tokenAddress) {
    let eventFilter = stARBIS.filters.RewardCollection();
    let events = await stARBIS.queryFilter(eventFilter);
    let event = events.filter(e => e.blockNumber == blockNumber && e.args.token == tokenAddress)[0];
    return event;
  }

  async function runJsonScenarioTest(testName) {
    console.log(`==== JSON TEST: ${testName} ====`);
    const tests = JSON.parse(fs.readFileSync("./test/stARBIS/scenarios.json").toString());
    for (const test of tests) {
      const name = test["name"];
      if (name != testName) {
        continue;
      }
      const actions = test["actions"];
      for (const action of actions) {
        switch (action["type"]) {
          case "reward": {
            console.log(`Add reward of ${action["amount"]}`);
            let amount = ethers.utils.parseEther(action["amount"]);
            await weth.approve(stARBIS.address, amount)
            await stARBIS.addReward(weth.address, amount);
            break;
          }
          case "stake": {
            let expected = null;
            if (action.hasOwnProperty("expect")) {
              expected = ethers.utils.parseEther(action["expect"]);
            }
            let amount = ethers.utils.parseEther(action["amount"]);
            let account_num = parseInt(action["account"]);
            let account = accounts[account_num];
            console.log(`Account ${account_num} staking ${action["amount"]} tokens`);
            await stakeToken.connect(account).approve(stARBIS.address, amount);
            let tx = await stARBIS.connect(account).stake(amount);
            if (expected !== null) {
              // Contract will pay rewards when increasing stake
              let event = await getRewardEventFromBlock(tx.blockNumber, weth.address);
              let rewards = event.args.amount;
              console.log("Amount collected : ", ethers.utils.formatEther(rewards));
              expect(rewards, "Didn't collect the expected amount").to.be.closeTo(expected, ethers.utils.parseEther("0.0001"));
            }
            break;
          }
          case "withdraw": {
            let expected = null;
            if (action.hasOwnProperty("expect")) {
              expected = ethers.utils.parseEther(action["expect"]);
            }
            let amount = ethers.utils.parseEther(action["amount"]);
            let account_num = parseInt(action["account"]);
            let account = accounts[account_num];
            console.log(`Account ${account_num} withdrawing ${action["amount"]}`);
            let tx = await stARBIS.connect(account).withdraw(amount);
            if (expected !== null) {
              // Contract will pay rewards if no stake left
              let event = await getRewardEventFromBlock(tx.blockNumber, weth.address);
              let rewards = event.args.amount;
              console.log("Amount collected : ", ethers.utils.formatEther(rewards));
              expect(rewards, "Didn't collect the expected amount").to.be.closeTo(expected, ethers.utils.parseEther("0.0001"));
            }
            break;
          }
          case "collect": {
            let expected = null;
            if (action.hasOwnProperty("expect")) {
              expected = ethers.utils.parseEther(action["expect"]);
            }
            let account_num = parseInt(action["account"]);
            console.log(`account ${account_num} collecting rewards`);
            let account = accounts[account_num];
            let tx = await stARBIS.connect(account).collectRewards();
            let event = await getRewardEventFromBlock(tx.blockNumber, weth.address);
            let rewards = event.args.amount;
            console.log("Amount collected : ", ethers.utils.formatEther(rewards));
            expect(rewards, "Didn't collect the expected amount").to.be.closeTo(expected, ethers.utils.parseEther("0.0001"));
            break;
          }
          default:
            console.log("Unsupported action type in test: ", action["type"]);
        }
      }  
    }
  }

  it("Scenarios - simple_stake_withdraw", async () => {
    await runJsonScenarioTest("simple_stake_withdraw");
  });

  it("Scenarios - no_stake_rewards", async () => {
    await runJsonScenarioTest("no_stake_rewards");
  });

  it("Scenarios - big_one", async () => {
    await runJsonScenarioTest("big_one");
  });
});
