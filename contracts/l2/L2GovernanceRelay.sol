// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
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


import {OVM_CrossDomainEnabled} from "@eth-optimism/contracts/build/contracts/libraries/bridge/OVM_CrossDomainEnabled.sol";

// Receive xchain message from L1 counterpart and execute given spell

contract L2GovernanceRelay is OVM_CrossDomainEnabled {

  event Initialized(address l1GovernanceRelay);

  address public l1GovernanceRelay;

  constructor(
    address _l2CrossDomainMessenger
  )
    OVM_CrossDomainEnabled(_l2CrossDomainMessenger)
  {}

  function init(
    address _l1GovernanceRelay
  )
    external
  {
    require(address(l1GovernanceRelay) == address(0), "Contract has already been initialized");

    l1GovernanceRelay = _l1GovernanceRelay;
      
    emit Initialized(_l1GovernanceRelay);
  }

  modifier onlyInitialized() {
    require(address(l1GovernanceRelay) != address(0), "Contract has not yet been initialized");
    _;
  }

  /**
   * @dev Execute the call from L1.
   */
  function relay(address target, bytes calldata targetData)
    external
    onlyInitialized()
    onlyFromCrossDomainAccount(address(l1GovernanceRelay))
  {
    // Ensure no storage changes in the delegate call
    address _l1GovernanceRelay = l1GovernanceRelay;
    address _messenger = messenger;

    bool ok;
    (ok,) = target.delegatecall(targetData);
    require(ok, "L2GovernanceRelay/delegatecall-error");

    require(_l1GovernanceRelay == l1GovernanceRelay && _messenger == messenger, "L2GovernanceRelay/illegal-storage-change");
  }
}
