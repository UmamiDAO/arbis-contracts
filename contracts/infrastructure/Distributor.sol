// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Distributor is AccessControl, ReentrancyGuard {
  using SafeERC20 for IERC20;

  address[] public destinations;
  uint256[] public shares;
  address[] public distributedTokens;
  mapping(address => bool) public isDistributedToken;
  uint256 public immutable SCALE = 1e8;
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  string public name;

  constructor(string memory _name) {
    name = _name;
    _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
  }

  event DistributedToken(address token, uint256 amount);

  function setDestinations(address[] calldata _destinations, uint256[] calldata _shares) external onlyAdmin {
    require(_destinations.length == _shares.length, "Destinations and shares different lengths");
    delete destinations;
    delete shares;
    for (uint256 i = 0; i < _destinations.length; i++) {
      destinations.push(_destinations[i]);
    }
    for (uint256 i = 0; i < _shares.length; i++) {
      shares.push(_shares[i]);
    }
  }

  function distribute() public nonReentrant {
    for (uint256 i = 0; i < distributedTokens.length; i++) {
      address token = distributedTokens[i];
      uint256 tokenBalance = IERC20(token).balanceOf(address(this));
      if (tokenBalance == 0) {
        // Nothing to distribute for this token
        continue;
      }
      for (uint256 j = 0; j < destinations.length; j++) {
        uint256 shareAmount = (tokenBalance * shares[j]) / SCALE;
        IERC20(token).safeTransfer(destinations[j], shareAmount);
        emit DistributedToken(token, shareAmount);
      }
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

  function setName(string calldata _name) external onlyAdmin {
    name = _name;
  }

  modifier onlyAdmin() {
    require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
    _;
  }
}