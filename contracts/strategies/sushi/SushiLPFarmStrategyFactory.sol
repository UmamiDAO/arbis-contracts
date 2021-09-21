// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "contracts/strategies/sushi/SushiLPFarmStrategy.sol";


contract SushiLPFarmStrategyFactory is Ownable {
  address[] public farms;
  uint256 public farmsCount;
  
  function addFarm(
      string memory _name,
      string memory _symbol,
      address _depositToken, 
      address _rewardToken,
      address _stakingContract,
      address _router,
      uint256 _pid) public onlyOwner {
    SushiLPFarmStrategy farm = new SushiLPFarmStrategy(
      _name, 
      _symbol, 
      _depositToken,  
      _rewardToken, 
      _stakingContract, 
      _router, 
      _pid);
    farms.push(address(farm)); 
    farmsCount = farmsCount + 1;
  }
  
  function removeFarm(uint256 farmIndex) public onlyOwner {
    delete farms[farmIndex];
    farmsCount = farmsCount - 1;
  }
}