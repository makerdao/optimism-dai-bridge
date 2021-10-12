// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
pragma solidity >=0.7.6;

interface MintLike {
  function mint(address to, uint256 value) external;
}

/**
 * An example spell to mint some dai.
 */
contract TestDaiMintSpell {
  function mintDai(
    address _dai,
    address _user,
    uint256 _amount
  ) external {
    MintLike(_dai).mint(_user, _amount);
  }
}
