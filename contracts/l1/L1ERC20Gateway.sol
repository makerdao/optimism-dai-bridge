// SPDX-License-Identifier: MIT
// Copyright (C) 2021 Dai Foundation
// @unsupported: ovm
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {Abs_L1TokenGateway} from '@eth-optimism/contracts/build/contracts/OVM/bridge/tokens/Abs_L1TokenGateway.sol';
import {iOVM_ERC20} from '@eth-optimism/contracts/build/contracts/iOVM/precompiles/iOVM_ERC20.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {L2DepositedToken} from '../l2/L2DepositedToken.sol';

contract L1ERC20Gateway is Abs_L1TokenGateway, Ownable {
  iOVM_ERC20 public l1ERC20;
  address public escrow;
  bool public isOpen = true;

  /***************
   * Constructor *
   ***************/

  /**
   * @param _l1ERC20 L1 ERC20 address this contract stores deposits for
   * @param _l2DepositedERC20 L2 Gateway address on the chain being deposited into
   */
  constructor(
    iOVM_ERC20 _l1ERC20,
    address _l2DepositedERC20,
    address _l1messenger,
    address _escrow
  ) Abs_L1TokenGateway(_l2DepositedERC20, _l1messenger) {
    l1ERC20 = _l1ERC20;
    escrow = _escrow;
  }

  function close() public onlyOwner {
    isOpen = false;
  }

  /**************
   * Accounting *
   **************/

  /**
   * @dev When a deposit is initiated on L1, the L1 Gateway
   * transfers the funds to itself for future withdrawals
   *
   * @param _from L1 address ETH is being deposited from
   * @param _to L2 address that the ETH is being deposited to
   * @param _amount Amount of ERC20 to send
   */
  function _handleInitiateDeposit(
    address _from,
    address _to,
    uint256 _amount
  ) internal override {
    require(isOpen, 'L1ERC20Gateway/closed');

    l1ERC20.transferFrom(_from, escrow, _amount);
  }

  /**
   * @dev When a withdrawal is finalized on L1, the L1 Gateway
   * transfers the funds to the withdrawer
   *
   * @param _to L1 address that the ERC20 is being withdrawn to
   * @param _amount Amount of ERC20 to send
   */
  function _handleFinalizeWithdrawal(address _to, uint256 _amount) internal override {
    // Transfer withdrawn funds out to withdrawer
    l1ERC20.transferFrom(escrow, _to, _amount);
  }
}
