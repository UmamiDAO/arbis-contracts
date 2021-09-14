// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

interface IMiniChefV2  {
    function pendingSushi(uint256 _pid, address _user) external view returns (uint256 pending);
    function deposit(uint256 pid, uint256 amount, address to) external;
    function withdraw(uint256 pid, uint256 amount, address to) external;
    function harvest(uint256 pid, address to) external;
}
