// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract stARBIS is ERC20, AccessControl, ReentrancyGuard {
  using SafeERC20 for IERC20;

  IERC20 public immutable arbisToken;
  
  uint256 public totalStaked = 0;
  address payable public feeDestination;
  uint256 public earlyWithdrawalFee = 0;
  uint256 public earlyWithdrawalDistributeShare = 0;
  uint256 public earlyWithdrawalSecondsThreshold = 0;
  address payable[] stakeholders;
  mapping(address => uint256) public excessTokenRewards;
  mapping(address => uint256) public totalCumTokenRewardsPerStake;
  mapping(address => uint256) public paidCumRewardsPerStake;
  mapping(address => mapping(address => uint256)) public paidCumTokenRewardsPerStake;
  mapping(address => uint256) public stakedBalance;
  address[] public rewardTokens;
  mapping(address => bool) public isApprovedRewardToken;
  mapping(address => Stakeholder) public stakeholderInfo;
  mapping(address => StakeTime[]) public lastStakes;
  uint256 constant SCALE = 1e8;

  event Stake(address addr, uint256 amount);
  event Withdrawal(address addr, uint256 amount);
  event RewardCollection(address addr, uint256 amount);
  event TokenRewardCollection(address token, address addr, uint256 amount);

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  struct StakeTime {
    uint256 amount;
    uint256 time;
    uint256 feeEligible;
  }

  struct Stakeholder {
    bool exists;
    uint256 idx;
  }

  constructor(
      address _arbisToken
    ) ERC20("Staked ARBIS", "stARBIS") {
    arbisToken = IERC20(_arbisToken);
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    rewardTokens.push(_arbisToken);
    isApprovedRewardToken[_arbisToken] = true;
  }

  function addReward(address token, uint256 reward) external {
    _addReward(token, reward, false);
  }

  function _addReward(address token, uint256 reward, bool intern) private {
    require(isApprovedRewardToken[token], "Token is not approved for rewards");
    console.log("Adding internal reward of token %s from address %s", token, msg.sender);
    if (!intern) {
      IERC20(token).safeTransferFrom(msg.sender, address(this), reward);
    }
    if (totalStaked == 0) {
      // Rewards which nobody is eligible for
      excessTokenRewards[token] += reward;
      return;
    }
    uint256 rewardPerStake = (reward * SCALE) / totalStaked;
    totalCumTokenRewardsPerStake[token] += rewardPerStake;
  }

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Invalid stake amount");

    StakeTime memory s = StakeTime(amount, block.timestamp, amount);
    lastStakes[msg.sender].push(s);

    // Transfer from msg.sender to us
    arbisToken.safeTransferFrom(msg.sender, address(this), amount);

    // Mint stARBIS
    _mint(msg.sender, amount);

    if (!stakeholderInfo[msg.sender].exists) {
      Stakeholder memory sh = Stakeholder(true, stakeholders.length);
      stakeholders.push(payable(msg.sender));
      stakeholderInfo[msg.sender] = sh;

      // Not eligible for any previous rewards on any token
      for (uint256 i = 0; i < rewardTokens.length; i++) {
        address token = rewardTokens[i];
        paidCumTokenRewardsPerStake[token][msg.sender] = totalCumTokenRewardsPerStake[token];
      }
    }
    else {
      _collectRewards();
    }

    totalStaked += amount;
    stakedBalance[msg.sender] += amount;
    emit Stake(msg.sender, amount);
  }

  function withdraw(uint256 amount) public nonReentrant {
    require(amount > 0, "Invalid withdraw amount");
    require(amount <= stakedBalance[msg.sender], "Insufficient balance");

    // Burn stARBIS
    _burn(msg.sender, amount);

    if (stakedBalance[msg.sender] - amount == 0) {
      // No stake left, so we pay rewards to simplify bookkeeping
      _collectRewards();
    }

    stakedBalance[msg.sender] -= amount;
    totalStaked -= amount;

    uint256 amountEligibleForFee = getAndUpdateAmountEligibleForEarlyWithdrawalFee(amount);
    console.log("Amount eligible for fee: %s", amountEligibleForFee);
    uint256 fee = (amountEligibleForFee * earlyWithdrawalFee) / SCALE;
    console.log("Fee: %s", fee);
    uint256 redistributedAmount = (fee * earlyWithdrawalDistributeShare) / SCALE;
    console.log("Redistributed amount: %s", redistributedAmount);
    uint256 remaining = fee - redistributedAmount;

    // Redistribute portion of fee to stakers
    _addReward(address(arbisToken), redistributedAmount, true);

    // The rest goes to the treasury
    if (feeDestination != address(0)) {
      arbisToken.safeTransfer(feeDestination, fee);
    }
    
    // Return ARBIS to the sender, minus any early withdrawal fees
    arbisToken.safeTransfer(msg.sender, amount - fee);

    if (stakedBalance[msg.sender] == 0) { 
      // Remove our records of this stakeholder
      uint256 idx = stakeholderInfo[msg.sender].idx;
      stakeholders[idx] = stakeholders[stakeholders.length - 1];
      stakeholderInfo[stakeholders[idx]].idx = idx;
      stakeholders.pop();
      delete stakeholderInfo[msg.sender];
    }
    emit Withdrawal(msg.sender, amount);
  }

  function _collectRewards() private {
    for (uint256 i = 0; i < rewardTokens.length; i++) {
      _collectRewardsForToken(rewardTokens[i]);
    }
  }

  function _collectRewardsForToken(address token) private {
    require(stakedBalance[msg.sender] > 0, "No stake for rewards");
    uint256 owedPerUnitStake = totalCumTokenRewardsPerStake[token] - paidCumTokenRewardsPerStake[token][msg.sender];
    uint256 totalRewards = (stakedBalance[msg.sender] * owedPerUnitStake) / SCALE;
    paidCumTokenRewardsPerStake[token][msg.sender] = totalCumTokenRewardsPerStake[token];
    IERC20(token).safeTransfer(msg.sender, totalRewards);
    emit RewardCollection(msg.sender, totalRewards);
  }

  function getEligibleRewardsOfToken(address token) external returns (uint256 totalRewards) {
    uint256 owedPerUnitStake = totalCumTokenRewardsPerStake[token] - paidCumTokenRewardsPerStake[token][msg.sender];
    totalRewards = (stakedBalance[msg.sender] * owedPerUnitStake) / SCALE;
  }

  function getAndUpdateAmountEligibleForEarlyWithdrawalFee(uint256 withdrawalAmount) private returns (uint256) {
    console.log("Calculating eligible fee amount for withdrawal of size %s for %s", withdrawalAmount, msg.sender);
    StakeTime[] storage stakes = lastStakes[msg.sender];
    if (stakes.length == 0) {
      return 0;
    }
    // Walk backwards through stakes to determine how much of withdrawal amount
    // was deposited within penalty window.
    uint256 i = stakes.length - 1;
    uint256 remaining = withdrawalAmount;
    while (true) {
      console.log("while loop %s", i);
      console.log("remaining: %s", remaining);
      if (stakes[i].time > block.timestamp - earlyWithdrawalSecondsThreshold && stakes[i].feeEligible != 0) {
        console.log("stake of size %s within penalty period", stakes[i].amount);
        // Amount was staked within penalty window
        uint256 feeEligible = stakes[i].feeEligible;
        console.log("fee eligible for stake %s: %s", i, feeEligible);
        if (feeEligible > remaining) {
          console.log("feeEligible > remaining");
          console.log("Updating fee eligible for stake %s from %s to %s", i, stakes[i].feeEligible, stakes[i].feeEligible - remaining);
          console.log("lastStakes[i].feeEligible: %s", lastStakes[msg.sender][i].feeEligible);
          stakes[i].feeEligible -= remaining;
          console.log("lastStakes[i].feeEligible: %s", lastStakes[msg.sender][i].feeEligible);
          remaining = 0;
          break;
        }
        else {
          // This whole stake was deposited in penalty window
          console.log("feeEligible <= remaining");
          remaining -= feeEligible;
          stakes[i].feeEligible = 0;
        }
      }
      else {
        console.log("stake of size %s older than penalty period (%s), breaking", stakes[i].amount, stakes[i].time);
        break;
      }
      if (i == 0) {
        // We're using a while to avoid an integer underflow exception
        break;
      }
      i--;
    }
    return withdrawalAmount - remaining;
  }

  function getNumberOfStakeholders() external view returns (uint256) {
    return stakeholders.length;
  }

  function collectRewards() external nonReentrant {
    // This function is required so it can be nonReentrant
    _collectRewards();
  }

  function setFeeDestination(address payable dest) external onlyAdmin {
    feeDestination = dest;
  }

  function setEarlyWithdrawalFee(uint256 fee) external onlyAdmin {
    earlyWithdrawalFee = fee;
  }

  function setEarlyWithdrawalDistributeShare(uint256 amount) external onlyAdmin {
    // The portion of the fee that is redistributed to stakers
    earlyWithdrawalDistributeShare = amount;
  }

  function setEarlyWithdrawalSecondsThreshold(uint256 threshold) external onlyAdmin {
    earlyWithdrawalSecondsThreshold = threshold;
  }

  function withdrawExcessRewards() external onlyAdmin {
    for (uint256 i = 0; i < rewardTokens.length; i++) {
      IERC20(rewardTokens[i]).safeTransfer(msg.sender, excessTokenRewards[rewardTokens[i]]);
    }
  }

  function addApprovedRewardToken(address token) external onlyAdmin {
    isApprovedRewardToken[token] = true;
    rewardTokens.push(token);
  }

  function removeApprovedRewardToken(address token) external onlyAdmin {
    for (uint256 i = 0; i < rewardTokens.length; i++) {
      if (rewardTokens[i] == token) {
        rewardTokens[i] = rewardTokens[rewardTokens.length - 1];
        rewardTokens.pop();
        isApprovedRewardToken[token] = false;
      }
    }
  }

  modifier onlyAdmin() {
    require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
    _;
  }
}