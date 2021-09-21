// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MultiSigPeriodicTimeLock {
    using SafeERC20 for IERC20;
    IERC20 public immutable token;
    address public beneficiary;
    uint256 public releaseTime;
    address[] public requiredSignatories;
    uint256 public period;

    enum Action {
      RELEASE,
      SET_BENEFICIARY
    }

    mapping(address => mapping(Action => bool)) public approvals;

    constructor(
      IERC20 _token, 
      address _beneficiary,
      uint256 _periodInSeconds,
      address[] memory _requiredSignatories
    ) {
      token = IERC20(_token);
      beneficiary = _beneficiary;
      period = _periodInSeconds;
      releaseTime = block.timestamp + period;
      for (uint256 i = 0; i < _requiredSignatories.length; i++) {
        requiredSignatories.push(_requiredSignatories[i]);
      }
    }

    function lock() external signatoryOnly afterTimeElapsed {
      releaseTime = block.timestamp + period;
    }

    function approve(Action action) external signatoryOnly {
      approvals[msg.sender][action] = true;
    }

    function setBeneficiary(address addr) external signatoryOnly requireApprovalFor(Action.SET_BENEFICIARY) {
      beneficiary = addr;
    }

    function release() external signatoryOnly afterTimeElapsed requireApprovalFor(Action.RELEASE) {
      uint256 amount = token.balanceOf(address(this));
      require(amount > 0, "No tokens to release");

      token.safeTransfer(beneficiary, amount);
    }

    modifier signatoryOnly() {
      bool found = false;
      for (uint256 i = 0; i < requiredSignatories.length; i++) {
        if (requiredSignatories[i] == msg.sender) {
          found = true;
        }
      }
      require(found, "Not signatory");
      _;
    }

    modifier requireApprovalFor(Action action) {
      for (uint256 i = 0; i < requiredSignatories.length; i++) {
        require(approvals[requiredSignatories[i]][action], "Signatory has not approved");
        approvals[requiredSignatories[i]][action] = false;
      }
      _;
    }
    
    modifier afterTimeElapsed {
      require(block.timestamp >= releaseTime, "Current time is before release time");
      _;
    }
}