// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken2 is ERC20 {
  constructor(uint256 supply) ERC20("Test Token", "TEST") {
    _mint(msg.sender, supply);
  }
}