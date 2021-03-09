pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/**
ONLY PURPOSE FOR THIS FILE IS TO FORCE HARDHAT TO COMPILE CONTRACT FROM @eth-optmism/contracts
 */

import {
  OVM_L1CrossDomainMessenger
} from '@eth-optimism/contracts/build/contracts/OVM/bridge/messaging/OVM_L1CrossDomainMessenger.sol';

contract OVM_L1CrossDomainMessengerLocal is OVM_L1CrossDomainMessenger {}
