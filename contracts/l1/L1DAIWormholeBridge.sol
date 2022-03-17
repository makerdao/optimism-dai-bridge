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
import {WormholeGUID} from "../common/WormholeGUID.sol";
import {IL1WormholeBridge, L1WormholeRouter} from "../common/WormholeInterfaces.sol";

interface TokenLike {
  function approve(address, uint256) external returns (bool);

  function transferFrom(
    address _from,
    address _to,
    uint256 _value
  ) external returns (bool success);
}

contract L1DAIWormholeBridge is OVM_CrossDomainEnabled, IL1WormholeBridge {
  address public immutable override l1Token;
  address public immutable override l2WormholeBridge;
  address public immutable override l1Escrow;
  L1WormholeRouter public immutable override l1WormholeRouter;

  constructor(
    address _l1Token,
    address _l2WormholeBridge,
    address _l1Messenger,
    address _l1Escrow,
    address _l1WormholeRouter
  ) OVM_CrossDomainEnabled(_l1Messenger) {
    l1Token = _l1Token;
    l2WormholeBridge = _l2WormholeBridge;
    l1Escrow = _l1Escrow;
    l1WormholeRouter = L1WormholeRouter(_l1WormholeRouter);
    // Approve the router to pull DAI from this contract during settle() (after the DAI has been pulled by this contract from the escrow)
    TokenLike(_l1Token).approve(_l1WormholeRouter, type(uint256).max);
  }

  function finalizeFlush(bytes32 targetDomain, uint256 daiToFlush)
    external
    override
    onlyFromCrossDomainAccount(l2WormholeBridge)
  {
    // Pull DAI from the escrow to this contract
    TokenLike(l1Token).transferFrom(l1Escrow, address(this), daiToFlush);
    // The router will pull the DAI from this contract
    l1WormholeRouter.settle(targetDomain, daiToFlush);
  }

  function finalizeRegisterWormhole(WormholeGUID calldata wormhole)
    external
    override
    onlyFromCrossDomainAccount(l2WormholeBridge)
  {
    l1WormholeRouter.requestMint(wormhole, 0, 0);
  }
}
