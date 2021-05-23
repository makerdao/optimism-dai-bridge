// SPDX-License-Identifier: AGPL-3.0-or-later
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
