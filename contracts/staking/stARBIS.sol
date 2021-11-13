// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

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
  address payable[] public stakeholders;
  mapping(address => uint256) public excessTokenRewards;
  mapping(address => uint256) public totalCumTokenRewardsPerStake;
  mapping(address => mapping(address => uint256)) public paidCumTokenRewardsPerStake;
  mapping(address => uint256) public stakedBalance;
  address[] public rewardTokens;
  mapping(address => bool) public isApprovedRewardToken;
  mapping(address => Stakeholder) public stakeholderInfo;
  mapping(address => uint256) public lastStakeTime;
  uint256 constant public SCALE = 1e40;

  event Stake(address addr, uint256 amount);
  event Withdrawal(address addr, uint256 amount);
  event RewardCollection(address token, address addr, uint256 amount);
  event RewardAdded(address token, uint256 amount, uint256 rps, bool intern);

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  struct Stakeholder {
    bool exists;
    uint256 idx;
  }

  constructor(
      address _arbisToken
    ) ERC20("Staked ARBIS/ETH LP", "stARBIS/ETH") {
    arbisToken = IERC20(_arbisToken);
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    rewardTokens.push(_arbisToken);
    isApprovedRewardToken[_arbisToken] = true;
  }

  function addReward(address token, uint256 amount) external nonReentrant {
    _addReward(token, amount, false);
  }

  function _addReward(address token, uint256 amount, bool intern) private {
    require(isApprovedRewardToken[token], "Token is not approved for rewards");
    if (!intern) {
      IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }
    if (totalStaked == 0) {
      // Rewards which nobody is eligible for
      excessTokenRewards[token] += amount;
      return;
    }
<<<<<<< HEAD
    uint256 rewardPerStake = (amount * SCALE) / totalStaked;
=======
    uint256 rewardPerStake = (reward * SCALE) / totalStaked;
    require(rewardPerStake > 0, "insufficient reward per stake");
>>>>>>> 82749462705b1a56d0ee666287352e3fdfd1c284
    totalCumTokenRewardsPerStake[token] += rewardPerStake;
    emit RewardAdded(token, amount, rewardPerStake, intern);
  }

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Invalid stake amount");
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
    lastStakeTime[msg.sender] = block.timestamp;
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

    // If you deposited anything within the threshold this will be penalised
    uint256 delta = block.timestamp - lastStakeTime[msg.sender];
    uint256 fee = 0;
    if (delta < earlyWithdrawalSecondsThreshold) {
      uint256 actualFeePct = earlyWithdrawalFee - ((delta * earlyWithdrawalFee) / earlyWithdrawalSecondsThreshold);
      fee = (amount * actualFeePct) / SCALE;
      uint256 redistributedAmount = (fee * earlyWithdrawalDistributeShare) / SCALE;
      uint256 remaining = fee - redistributedAmount;
      // Redistribute portion of fee to stakers
      _addReward(address(arbisToken), redistributedAmount, true);

      // The rest goes to the treasury
      if (feeDestination != address(0)) {
        arbisToken.safeTransfer(feeDestination, remaining);
      } 
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
    if (totalRewards > 0) {
      IERC20(token).safeTransfer(msg.sender, totalRewards);
    }
    emit RewardCollection(token, msg.sender, totalRewards);
  }

  function getAvailableTokenRewards(address token) external view returns (uint256 totalRewards) {
    uint256 owedPerUnitStake = totalCumTokenRewardsPerStake[token] - paidCumTokenRewardsPerStake[token][msg.sender];
    totalRewards = (stakedBalance[msg.sender] * owedPerUnitStake) / SCALE;
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
      uint256 amount = excessTokenRewards[rewardTokens[i]];
      if (amount == 0) {
        continue;
      }
      IERC20(rewardTokens[i]).safeTransfer(msg.sender, amount);
      excessTokenRewards[rewardTokens[i]] = 0;
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

  function setScale(uint256 _scale) external onlyAdmin {
    SCALE = _scale;
  }

  function recoverEth() external onlyAdmin {
    // For recovering eth mistakenly sent to the contract
    (bool success, ) = msg.sender.call{value: address(this).balance}("");
    require(success, "Withdraw failed");
  }

  modifier onlyAdmin() {
    require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
    _;
  }
}