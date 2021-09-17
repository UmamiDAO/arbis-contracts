const { assert, expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require('fs');
const { format } = require("path");

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

    const factory = await ethers.getContractFactory("stARBIS");
    stARBIS = await factory.deploy(stakeToken.address);

    // Transfer first five addresses some tokens
    for (let i = 0; i < 5; i++) {
      await stakeToken.transfer(accounts[i].address, ethers.utils.parseEther("2000"));
    }

  });
  
  it("Staking - add reward", async function () {
    let amount = ethers.utils.parseEther("1");
    await stARBIS.addReward({value: amount});
    const balance = await provider.getBalance(stARBIS.address);
    expect(balance, "Reward value not added").to.equal(ethers.utils.parseEther("1"));
  });

  it("Staking - stake token transfer", async function () {
    let amount = ethers.utils.parseEther("150");
    await stakeToken.approve(stARBIS.address, amount);
    let before = await stakeToken.balanceOf(owner.address);
    await stARBIS.stake(amount);
    let after = await stakeToken.balanceOf(owner.address);
    expect(after, "Tokens weren't transferred ").to.equal(before.sub(amount));

    let contractBalance = await stakeToken.balanceOf(stARBIS.address);
    expect(contractBalance, "Tokens weren't received").to.equal(amount);
  });

  it("Staking - stake stARBIS mint", async function () {
    let amount = ethers.utils.parseEther("150");
    await stakeToken.approve(stARBIS.address, amount);
    await stARBIS.stake(amount);
    let balance = await stARBIS.balanceOf(owner.address);
    expect(balance, "stARBIS weren't minted").to.equal(amount);
  });

  it("Staking - withdraw", async function () {
    // TODO - test stARBIS burn
  });

  it("Scenarios", async () => {
    const tests = JSON.parse(fs.readFileSync("./test/stARBIS/scenarios.json").toString());
    for (const test of tests) {
      const name = test["name"];
      console.log(`==== JSON TEST: ${name} ====`);
      const actions = test["actions"];

      for (const action of actions) {
        switch (action["type"]) {
          case "reward": {
            console.log(`Add reward of ${action["amount"]}`);
            await stARBIS.addReward({
              value: ethers.utils.parseEther(action["amount"]),
            });
            break;
          }
          case "stake": {
            let expecting = null;
            let amount = ethers.utils.parseEther(action["amount"]);
            let account_num = parseInt(action["account"]);
            let account = accounts[account_num];
            console.log(`Account ${account_num} staking ${action["amount"]} tokens`);
            await stakeToken.connect(account).approve(stARBIS.address, amount);
            await stARBIS.connect(account).stake(amount);
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
            if (expected !== null) {
              // Contract will pay rewards if no stake left
              let tx = await stARBIS.connect(account).collectRewards();
              let eventListener = listenForContractEvents(stARBIS, "RewardCollection");
              let event = await eventListener;
              // Sometimes Hardhat and Ethers is weird and returns old events
              // so let's check this.
              if (tx.blockNumber == event.blockNumber) {
                let rewards = event.args.amount;
                expect(rewards, "Didn't collect the expected amount").to.equal(expected);
              }
              else {
                console.log("WARNING: old event returned");
              }
            }
            else {
              await stARBIS.connect(account).withdraw(amount);
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
            let eventListener = listenForContractEvents(stARBIS, "RewardCollection");
            let tx = await stARBIS.connect(account).collectRewards();
            let event = await eventListener;
            let rewards = event.args.amount;
            console.log("Amount collected : ", ethers.utils.formatEther(rewards));
            if (expected !== null) {
              if (tx.blockNumber == event.blockNumber) {
                let rewards = event.args.amount;
                expect(rewards, "Didn't collect the expected amount").to.equal(expected);
              }
              else {
                console.log("WARNING: old event returned");
              }
            }
            break;
          }
          default:
            console.log("Unsupported action type in test: ", action["type"]);
        }
      }      
    }
  }).timeout(1200000);
});
