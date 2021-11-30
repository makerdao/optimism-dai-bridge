// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
// @unsupported: ovm
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity >=0.7.6;
pragma abicoder v2;

import {iOVM_L1ERC20Bridge} from "@eth-optimism/contracts/iOVM/bridge/tokens/iOVM_L1ERC20Bridge.sol";
import {iOVM_L2ERC20Bridge} from "@eth-optimism/contracts/iOVM/bridge/tokens/iOVM_L2ERC20Bridge.sol";
import {OVM_CrossDomainEnabled} from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {WormholeGUID, WormholeLib} from "../common/LibWormholeGUID.sol";

interface WormholeRouter {
  function mint(WormholeGUID memory wormholeGUID, uint256 maxFees) external; // @todo is it "memory"?

  function settle(bytes32 targetDomain, uint256 daiToFlush) external;
}

contract L1DAIWormholeBridge is OVM_CrossDomainEnabled {
  using WormholeLib for WormholeGUID;
  // --- Auth ---
  mapping(address => uint256) public wards;

  function rely(address usr) external auth {
    wards[usr] = 1;
    emit Rely(usr);
  }

  function deny(address usr) external auth {
    wards[usr] = 0;
    emit Deny(usr);
  }

  modifier auth() {
    require(wards[msg.sender] == 1, "L1DAITokenBridge/not-authorized");
    _;
  }

  event Rely(address indexed usr);
  event Deny(address indexed usr);

  address public immutable l1Token;
  address public immutable l2DAITokenBridge;
  address public immutable l2Token;
  address public immutable escrow;
  WormholeRouter public immutable wormholeRouter;

  constructor(
    address _l1Token,
    address _l2DAITokenBridge,
    address _l2Token,
    address _l1messenger,
    address _escrow,
    address _wormholeRouter
  ) OVM_CrossDomainEnabled(_l1messenger) {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);

    l1Token = _l1Token;
    l2DAITokenBridge = _l2DAITokenBridge;
    l2Token = _l2Token;
    escrow = _escrow;
    wormholeRouter = WormholeRouter(_wormholeRouter);
  }

  function finalizeFlush(bytes32 targetDomain, uint256 daiToFlush)
    external
    onlyFromCrossDomainAccount(l2DAITokenBridge)
  {
    wormholeRouter.settle(targetDomain, daiToFlush);
  }

  function finalizeRegisterInboundWormhole(WormholeGUID calldata wormhole)
    external
    onlyFromCrossDomainAccount(l2DAITokenBridge)
  {
    wormholeRouter.mint(wormhole, 0);
  }
}
