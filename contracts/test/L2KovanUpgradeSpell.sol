// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
pragma solidity >=0.7.6;

interface AuthLike {
  function rely(address usr) external;
  function deny(address usr) external;
}

contract L2KovanUpgradeSpell {

  AuthLike immutable public l2Dai;
  address immutable public newBridge;

  constructor(address _l2Dai, address _newBridge) {
    l2Dai = AuthLike(_l2Dai);
    newBridge = _newBridge;
  }

  function upgradeBridge() external {
    l2Dai.rely(newBridge);
  }

}
