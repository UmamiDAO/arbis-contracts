// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "contracts/staking/stARBIS.sol";

contract stARBISReceiver is AccessControl, ReentrancyGuard {
  stARBIS public immutable stARBISContract;
  address[] distributedTokens; 
  mapping(address => bool) isDistributedToken;
  uint256 public immutable SCALE = 1e8;
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  constructor(address _stARBIS) {
    stARBISContract = stARBIS(_stARBIS);
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  event RewardAdded(address token, uint256 amount);

  function sendBalancesAsRewards() external onlyAdmin nonReentrant {
    for (uint256 i = 0; i < distributedTokens.length; i++) {
      address token = distributedTokens[i];
      uint256 tokenBalance = IERC20(token).balanceOf(address(this));
      if (tokenBalance == 0) { continue; }
      stARBISContract.addReward(token, tokenBalance);
      emit RewardAdded(token, tokenBalance);
    }
  }

  function addDistributedToken(address token) external onlyAdmin {
    isDistributedToken[token] = true;
    distributedTokens.push(token);
  }

  function removeDistributedToken(address token) external onlyAdmin {
    for (uint256 i = 0; i < distributedTokens.length; i++) {
      if (distributedTokens[i] == token) {
        distributedTokens[i] = distributedTokens[distributedTokens.length - 1];
        distributedTokens.pop();
        isDistributedToken[token] = false;
      }
    }
  }

  function recoverEth() external onlyAdmin {
    (bool success, ) = msg.sender.call{value: address(this).balance}("");
    require(success, "Withdraw failed");
  }

  modifier onlyAdmin() {
    require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
    _;
  }
}