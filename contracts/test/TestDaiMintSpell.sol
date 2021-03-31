// SPDX-License-Identifier: MIT
// Copyright (C) 2021 Dai Foundation
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

interface MintLike {
  function mint(address to, uint256 value) external;
}

/**
 * An example spell to mint some dai.
 */
contract TestDaiMintSpell {

  function mintDai(address _dai, address _user, uint256 _amount) external {
    MintLike(_dai).mint(_user, _amount);
  }

}
