// SPDX-License-Identifier: MIT
// Copyright (C) 2021 Dai Foundation
// @unsupported: ovm
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {iOVM_ERC20} from '@eth-optimism/contracts/build/contracts/iOVM/precompiles/iOVM_ERC20.sol';

contract L1Escrow is Ownable {
  function approve(
    iOVM_ERC20 token,
    address spender,
    uint256 value
  ) public onlyOwner {
    token.approve(spender, value);
  }
}
