// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StakedTokenHolder {
    uint256 public totalStaked;

    mapping(address => uint256) private _balances;
    IERC20 public stakedToken;
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor (address _stakedToken) {
        stakedToken = IERC20(_stakedToken);
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stakeFor(address forWhom, uint256 amount) public {
        require(amount > 0, "Invalid stake amount");
        uint256 allowance = stakedToken.allowance(forWhom, address(this));
        require(stakedToken.transferFrom(forWhom, address(this), amount), "Staked token transfer failed");
        totalStaked += amount;
        _balances[forWhom] += amount;
        emit Staked(forWhom, amount);
    }

    function withdrawTo(address toWhom, uint256 amount) public {
        require(amount > 0, "Invalid stake withdrawal amount");
        require(amount <= _balances[toWhom], "Insufficient balance");
        _balances[toWhom] -= amount;
        totalStaked -= amount;
        require(stakedToken.transfer(toWhom, amount), "Staked token transfer failed");
        emit Withdrawn(toWhom, amount);
    }
}
