// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
// @unsupported: ovm
pragma solidity >=0.7.6;

import {Abs_L1TokenGateway} from '@eth-optimism/contracts/build/contracts/OVM/bridge/tokens/Abs_L1TokenGateway.sol';
import {iOVM_ERC20} from '@eth-optimism/contracts/build/contracts/iOVM/precompiles/iOVM_ERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

// Managed locked funds in L1Escrow and send / receive messages to L2Gateway counterpart
// Note: when bridge is closed it will still process in progress messages

contract L1Gateway is Abs_L1TokenGateway, Ownable {
  iOVM_ERC20 public immutable l1ERC20;
  address public immutable escrow;
  bool public isOpen = true;

  constructor(
    iOVM_ERC20 _l1ERC20,
    address _l2DepositedERC20,
    address _l1messenger,
    address _escrow
  ) Abs_L1TokenGateway(_l2DepositedERC20, _l1messenger) {
    l1ERC20 = _l1ERC20;
    escrow = _escrow;
  }

  // --- Administration ---

  function close() external onlyOwner {
    isOpen = false;
  }

  // --- Internal methods ---

  function _handleInitiateDeposit(
    address _from,
    address _to,
    uint256 _amount
  ) internal override {
    require(isOpen, 'L1Gateway/closed');

    l1ERC20.transferFrom(_from, escrow, _amount);
  }

  function _handleFinalizeWithdrawal(address _to, uint256 _amount) internal override {
    // Transfer withdrawn funds out to withdrawer
    l1ERC20.transferFrom(escrow, _to, _amount);
  }
}
