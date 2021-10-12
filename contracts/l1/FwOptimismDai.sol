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

import "hardhat/console.sol";
import "@eth-optimism/contracts/OVM/bridge/messaging/OVM_L1CrossDomainMessenger.sol";
import {Lib_CrossDomainUtils} from "@eth-optimism/contracts/libraries/bridge/Lib_CrossDomainUtils.sol";

interface DaiLike {
  function mint(address to, uint256 value) external;

  function burn(address from, uint256 value) external;
}

contract FwOptimismDai {
  OVM_L1CrossDomainMessenger public immutable xDomainMessager;
  DaiLike public immutable dai;
  address public daiBridgeL1;
  address public daiBridgeL2;
  mapping(bytes32 => bool) fastWithdrew;

  constructor(
    address _xDomainMessenger,
    address _dai,
    address _daiBridgeL1,
    address _daiBridgeL2
  ) {
    xDomainMessager = OVM_L1CrossDomainMessenger(_xDomainMessenger);
    dai = DaiLike(_dai);
    daiBridgeL1 = _daiBridgeL1;
    daiBridgeL2 = _daiBridgeL2;
  }

  function fastWithdraw(
    address target,
    address sender,
    bytes memory message,
    uint256 messageNonce,
    uint256 oracleAttestation // @todo type
  ) public {
    // validate withdrawal
    require(target == daiBridgeL1, "Not a valid withdrawal");
    require(sender == daiBridgeL2, "Not a valid withdrawal");
    // todo: validate message that is finalizeWithdrawal with data of user
    // todo: validate oracle attestation

    bytes32 messageHash = getMessageHash(target, sender, message, messageNonce);
    // ensure that it wasn't withdrew already
    require(xDomainMessager.successfulMessages(messageHash) == false, "Message already relied");
    require(fastWithdrawn[messageHash] == false, "Witdrawal already fast withdrew");

    dai.mint(msg.sender, 100);
    fastWithdrawn[messageHash] = true;
  }

  // @note: this has to be comptaible with hashing of optimism's xDomainMessenger
  function getMessageHash(
    address target,
    address sender,
    bytes memory message,
    uint256 messageNonce
  ) internal returns (bytes32) {
    bytes memory xDomainCalldata = Lib_CrossDomainUtils.encodeXDomainCalldata(
      target,
      sender,
      message,
      messageNonce
    );
    bytes32 xDomainCalldataHash = keccak256(xDomainCalldata);

    return xDomainCalldataHash;
  }
}
