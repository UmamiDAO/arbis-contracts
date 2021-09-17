// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

// import "contracts/StakedTokenWrapper.sol";
import "contracts/staking/StakedTokenHolder.sol";


contract stARBIS is ERC20, Ownable, ReentrancyGuard {
  IERC20 public immutable arbisToken;
  mapping(address => mapping(uint256 => uint256)) private stakeBalanceAt;
  mapping(address => uint256) private claimedUpToAndExcluding;
  mapping(uint256 => Window) private windows;
  mapping(address => uint256) public stakeBalances;
  uint256 currentWindow = 0;
  uint256 totalStaked = 0;

  event Stake(address addr, uint256 amount);
  event Withdrawal(address addr, uint256 amount);
  event RewardCollection(address addr, uint256 amount);

  enum WindowEventType {
    Deposit,
    Withdrawal,
    RewardCollection
  }

  struct Window {
    WindowEventType eventType;
    uint256 eventAmount;
    address eventAddress;
    uint256 rewardsInWindow;
    uint256 totalSupplyAtWindow;
  }

  constructor(
      address _arbisToken
    ) ERC20("Staked ARBIS", "stARBIS") {
    arbisToken = IERC20(_arbisToken);
  }

  function addReward() external payable {
    windows[currentWindow].rewardsInWindow += msg.value;
  }

  function incrementWindow(WindowEventType eventType, uint256 amount) private {
    currentWindow += 1;
    Window memory newWindow = Window(eventType, amount, msg.sender, 0, totalSupply());
    windows[currentWindow] = newWindow;
  }

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Invalid stake amount");

    // Transfer from msg.sender to us
    require(arbisToken.transferFrom(msg.sender, address(this), amount), "Staked token transfer failed");

    // Mint stARBIS
    _mint(msg.sender, amount);

    incrementWindow(WindowEventType.Deposit, amount);
    
    totalStaked += amount;
    stakeBalances[msg.sender] += amount;
    claimedUpToAndExcluding[msg.sender] = currentWindow;
    stakeBalanceAt[msg.sender][currentWindow] = stakeBalances[msg.sender];
    emit Stake(msg.sender, amount);
  }

  function withdraw(uint256 amount) public nonReentrant {
    require(amount > 0, "Invalid withdraw amount");
    require(amount <= stakeBalances[msg.sender], "Insufficient balance");
    
    // Burn stARBIS
    _burn(msg.sender, amount);

    incrementWindow(WindowEventType.Withdrawal, amount);

    // Return ARBIS to the sender
    require(arbisToken.transfer(msg.sender, amount), "Staked token transfer failed");

    stakeBalances[msg.sender] -= amount;
    totalStaked -= amount;

    if (balanceOf(msg.sender) == 0) {
      // No stake left, so we pay rewards to simplify bookkeeping
      _collectRewards();
    }
    emit Withdrawal(msg.sender, amount);
  }

  function _collectRewards() private {
    incrementWindow(WindowEventType.RewardCollection, 0);
    // Calculate rewards
    uint256 totalRewards = 0;
    uint256 startIdx = claimedUpToAndExcluding[msg.sender];
    uint256 amountStaked = stakeBalanceAt[msg.sender][startIdx];
    for (uint256 i = startIdx; i < currentWindow; i++) {
      // console.log("window %s", i);
      // Was this window created because we staked or withdrew?
      if (i > startIdx && windows[i].eventAddress == msg.sender) {
        uint256 eventAmount = windows[i].eventAmount;
        if (windows[i].eventType == WindowEventType.Deposit) {
          // console.log("Increasing stake by %s to %s", eventAmount, amountStaked + eventAmount);
          // Deposit - stake was increased
          amountStaked += eventAmount;
        }
        else if (windows[i].eventType == WindowEventType.Withdrawal) {
          // console.log("Decreasing stake by %s to %s", eventAmount, amountStaked - eventAmount);
          // Withdrawal - stake was decreased
          amountStaked -= eventAmount;
        }
      }

      // Calculate share of rewards in this window based on pool share at the time
      uint256 windowRewards = windows[i].rewardsInWindow;
      uint256 windowTotalSupply = windows[i].totalSupplyAtWindow;
      // console.log("windowRewards:       %s", windowRewards);
      // console.log("windowTotalSupply:   %s", windows[i].totalSupplyAtWindow);
      // console.log("amountStaked:        %s", amountStaked);
      if (windowTotalSupply != 0) {
        uint256 sharedRewards = (windowRewards * amountStaked * 10000) / (windowTotalSupply * 10000);
        // console.log("sharedRewards:     %s", sharedRewards);
        totalRewards += sharedRewards;
        // console.log("totalRewards:     %s", totalRewards);
      }
    }

    claimedUpToAndExcluding[msg.sender] = currentWindow;
    stakeBalanceAt[msg.sender][currentWindow] = balanceOf(msg.sender);

    // Send the ETH rewards
    (bool success, bytes memory data) = msg.sender.call{value: totalRewards}("");
    require(success, "Failed sending rewards");
    emit RewardCollection(msg.sender, totalRewards);
  }

  function collectRewards() external nonReentrant {
    // This function is required so it can be nonReentrant
    _collectRewards();
  }

  function setClaimedUpTo(address who, uint256 idx) external onlyOwner {
    claimedUpToAndExcluding[who] = idx;
  }
}