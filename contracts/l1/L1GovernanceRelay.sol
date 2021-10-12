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

import {OVM_CrossDomainEnabled} from "@eth-optimism/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";

import "../l2/L2GovernanceRelay.sol";

// Relay a message from L1 to L2GovernanceRelay

contract L1GovernanceRelay is OVM_CrossDomainEnabled {
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
    require(wards[msg.sender] == 1, "L1GovernanceRelay/not-authorized");
    _;
  }

  address public immutable l2GovernanceRelay;

  event Rely(address indexed usr);
  event Deny(address indexed usr);

  constructor(address _l2GovernanceRelay, address _l1messenger)
    OVM_CrossDomainEnabled(_l1messenger)
  {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);

    l2GovernanceRelay = _l2GovernanceRelay;
  }

  // Forward a call to be repeated on L2
  function relay(
    address target,
    bytes calldata targetData,
    uint32 l2gas
  ) external auth {
    bytes memory data = abi.encodeWithSelector(
      L2GovernanceRelay.relay.selector,
      target,
      targetData
    );

    sendCrossDomainMessage(l2GovernanceRelay, l2gas, data);
  }
}
