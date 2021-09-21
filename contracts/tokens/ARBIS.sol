// SPDX-License-Identifier: GNU GPLv3
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ARBIS is ERC20 {
    constructor() ERC20("ARBIS | We have the yields", "ARBIS") {
        _mint(msg.sender, 50000000000000000000000000000);
    }
}