pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/**
ONLY PURPOSE FOR THIS FILE IS TO FORCE HARDHAT TO COMPILE CONTRACT FROM @eth-optmism/contracts
 */

import {
  OVM_L1CrossDomainMessenger
} from '@eth-optimism/contracts/build/contracts/OVM/bridge/messaging/OVM_L1CrossDomainMessenger.sol';
import {
  OVM_L2CrossDomainMessenger
} from '@eth-optimism/contracts/build/contracts/OVM/bridge/messaging/OVM_L2CrossDomainMessenger.sol';

contract OVM_L1CrossDomainMessengerLocal is OVM_L1CrossDomainMessenger {}

contract OVM_L2CrossDomainMessengerLocal is OVM_L2CrossDomainMessenger {
  constructor(address _libAddressManager) public OVM_L2CrossDomainMessenger(_libAddressManager) {}
}
