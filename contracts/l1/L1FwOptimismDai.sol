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
import {iOVM_L1ERC20Bridge} from "@eth-optimism/contracts/iOVM/bridge/tokens/iOVM_L1ERC20Bridge.sol";
import {Lib_CrossDomainUtils} from "@eth-optimism/contracts/libraries/bridge/Lib_CrossDomainUtils.sol";
import {Lib_BytesUtils} from "@eth-optimism/contracts/libraries/utils/Lib_BytesUtils.sol";

interface DaiLike {
  function mint(address to, uint256 value) external;

  function burn(address from, uint256 value) external;

  function transfer(address to, uint256 value) external returns (bool);
}

contract L1FwOptimismDai {
  OVM_L1CrossDomainMessenger public immutable xDomainMessager;
  DaiLike public immutable dai;
  address public daiBridgeL1;
  address public daiBridgeL2;

  enum WithdrawalStatus {
    UNKNOWN,
    FAST_WITHDRAWN,
    CLAIMED,
    SETTLED
  }
  mapping(bytes32 => WithdrawalStatus) withdrawals;

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
    bytes memory message, // @todo calldata?
    uint256 messageNonce,
    uint256 oracleAttestation // @todo type
  ) public {
    (address msgFrom, address msgTo, uint256 msgAmt) = validateAndParseWithdrawal(
      target,
      sender,
      message,
      messageNonce
    );
    // todo:ensure msg.sender == msgFrom
    // todo: validate oracle attestation

    bytes32 messageHash = getMessageHash(target, sender, message, messageNonce);

    require(xDomainMessager.successfulMessages(messageHash) == false, "Message already relied");
    require(withdrawals[messageHash] == WithdrawalStatus.UNKNOWN, "Witdrawal status incorrect");

    dai.mint(msgFrom, msgAmt);

    withdrawals[messageHash] = WithdrawalStatus.FAST_WITHDRAWN;
  }

  function settle(
    address target,
    address sender,
    bytes memory message, // @todo calldata?
    uint256 messageNonce
  ) public {
    (address msgFrom, address msgTo, uint256 msgAmt) = validateAndParseWithdrawal(
      target,
      sender,
      message,
      messageNonce
    );
    // todo: validate oracle attestation

    bytes32 messageHash = getMessageHash(target, sender, message, messageNonce);

    require(xDomainMessager.successfulMessages(messageHash) == true, "Message not relied");
    require(
      withdrawals[messageHash] == WithdrawalStatus.FAST_WITHDRAWN,
      "Witdrawal status incorrect"
    );

    dai.burn(address(this), msgAmt);

    withdrawals[messageHash] = WithdrawalStatus.SETTLED;
  }

  // used to recover "slow withdrawals"
  function claimWithdraw(
    address target,
    address sender,
    bytes memory message,
    uint256 messageNonce
  ) public {
    (address msgFrom, address msgTo, uint256 msgAmt) = validateAndParseWithdrawal(
      target,
      sender,
      message,
      messageNonce
    );
    // todo: validate oracle attestation

    bytes32 messageHash = getMessageHash(target, sender, message, messageNonce);

    require(xDomainMessager.successfulMessages(messageHash) == true, "Message not relied");
    require(withdrawals[messageHash] == WithdrawalStatus.UNKNOWN, "Witdrawal status incorrect");

    dai.transfer(msgFrom, msgAmt);

    withdrawals[messageHash] = WithdrawalStatus.CLAIMED;
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

  function validateAndParseWithdrawal(
    address target,
    address sender,
    bytes memory message,
    uint256 messageNonce
  )
    internal
    returns (
      address,
      address,
      uint256
    )
  {
    require(target == daiBridgeL1, "Not a valid withdrawal (target)");
    require(sender == daiBridgeL2, "Not a valid withdrawal (sender)");
    bytes4 msgSelector = bytes4(
      (uint32(uint8(message[0])) << 24) |
        (uint32(uint8(message[1])) << 16) |
        (uint32(uint8(message[2])) << 8) |
        (uint32(uint8(message[3])))
    );
    require(
      msgSelector == iOVM_L1ERC20Bridge.finalizeERC20Withdrawal.selector,
      "Not a valid withdrawal (message.signature)"
    );
    (
      address _msgL1Token,
      address _msgL2Token,
      address msgFrom,
      address msgTo,
      uint256 msgAmt,
      bytes memory msgData
    ) = abi.decode(
        Lib_BytesUtils.slice(message, 4, message.length - 4),
        (address, address, address, address, uint256, bytes)
      );
    // we don't need to verify msgL1Token and msgL2Token as they should be always correct
    require(msgTo == address(this), "Not a valid withdrawal (msgTo)");

    return (msgFrom, msgTo, msgAmt);
  }
}
