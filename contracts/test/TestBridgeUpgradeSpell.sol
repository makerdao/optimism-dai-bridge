// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
pragma solidity >=0.7.6;

interface BridgeLike {
  function close() external;

  function token() external view returns (address);
}

interface AuthLike {
  function rely(address usr) external;

  function deny(address usr) external;
}

/**
 * An example spell to transfer from the old bridge to the new one.
 */
contract TestBridgeUpgradeSpell {
  function upgradeBridge(address _oldBridge, address _newBridge) external {
    BridgeLike oldBridge = BridgeLike(_oldBridge);
    AuthLike dai = AuthLike(oldBridge.token());

    oldBridge.close();
    dai.deny(_oldBridge);
    dai.rely(_newBridge);
  }
}
