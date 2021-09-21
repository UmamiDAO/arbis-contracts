// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
  constructor() ERC20("Test Token", "TEST") {
    _mint(msg.sender, 1000000 * 10**uint(decimals()));
  }
}