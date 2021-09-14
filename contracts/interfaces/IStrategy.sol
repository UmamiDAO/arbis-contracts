// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.0;

interface IStrategy {
    function getName() external returns(string memory);
    function getUnderlying() external returns(address);
    function deposit(uint amount) external;
    function reinvest() external;
    function withdraw(uint amount) external;
}