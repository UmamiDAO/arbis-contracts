// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "contracts/StakedTokenWrapper.sol";

interface IStakingContract {
  function stakeFor(address forWhom, uint128 amount) external payable;
  function withdraw(uint128 amount) external;
  function balanceOf(address account) external view returns (uint256);
}

contract stARBIS is ERC20, Ownable, ReentrancyGuard {
  IERC20 public immutable arbisToken;
  IStakingContract public immutable stakingContract;
  mapping(address => mapping(uint256 => uint256)) private stakeBalanceAt;
  mapping(address => uint256) private claimedUpToAndExcluding;
  mapping(uint256 => Window) private windows;
  uint256 currentWindow = 0;

  struct Window {
    bool eventIsDeposit;
    uint256 eventAmount;
    address eventAddress;
    uint256 rewardsInWindow;
    uint256 totalSupplyAtWindow;
  }

  constructor(
      string memory _name, 
      string memory _symbol, 
      address _arbisToken,
      address _stakingContract
    ) ERC20(_name, _symbol) {
    arbisToken = IERC20(_arbisToken);
    stakingContract = IStakingContract(_stakingContract);
  }

  function approveStaking(uint256 amount) public {
    arbisToken.approve(address(stakingContract), amount);
  }

  function addReward() external payable {
    windows[currentWindow].rewardsInWindow += msg.value;
  }

  function stake(uint256 amount) external nonReentrant {
    require(amount > 0, "Invalid stake amount");

    // Transfer ARBIS to staking contract
    stakingContract.stakeFor(msg.sender, uint128(amount));

    // Mint stARBIS
    _mint(msg.sender, amount);

    incrementWindow(true, amount);
    stakeBalanceAt[msg.sender][currentWindow] = balanceOf(msg.sender);
  }

  function incrementWindow(bool isDeposit, uint256 amount) private {
    currentWindow += 1;
    Window memory newWindow = Window(isDeposit, amount, msg.sender, 0, totalSupply());
    windows[currentWindow] = newWindow;
  }

  function withdraw(uint256 amount) public nonReentrant {
    require(amount > 0, "Invalid withdraw amount");

    // Burn stARBIS
    _burn(msg.sender, amount);

    incrementWindow(false, amount);

    // Calculate rewards
    uint256 totalRewards = 0;
    uint256 startIdx = claimedUpToAndExcluding[msg.sender];
    uint256 amountStaked = stakeBalanceAt[msg.sender][startIdx];
    for (uint256 i = startIdx; i < currentWindow; i++) {
      // Was this window created because we staked or withdrew?
      if (i > startIdx && windows[i].eventAddress == msg.sender) {
        uint256 eventAmount = windows[i].eventAmount;
        if (windows[i].eventIsDeposit) {
          // Deposit - stake was increased
          amountStaked += eventAmount;
        }
        else {
          // Withdrawal - stake was decreased
          amountStaked -= eventAmount;
        }
      }

      // Calculate share of rewards in this window based on pool share at the time.
      uint256 windowRewards = windows[i].rewardsInWindow;
      uint256 windowTotalSupply = windows[i].totalSupplyAtWindow;
      uint256 sharedRewards = (windowRewards * balanceOf(msg.sender) * 10000) / (windowTotalSupply * 10000);
      totalRewards += sharedRewards;
    }

    claimedUpToAndExcluding[msg.sender] = currentWindow;
    stakeBalanceAt[msg.sender][currentWindow] = balanceOf(msg.sender);

    // Return the ARBIS
    stakingContract.withdraw(uint128(amount));

    // Send the ETH rewards
    (bool success, bytes memory data) = msg.sender.call{value: totalRewards}("");
    require(success, "Failed sending rewards");
  }
}