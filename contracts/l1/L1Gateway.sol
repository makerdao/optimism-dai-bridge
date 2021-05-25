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

import {Abs_L1TokenGateway} from '@eth-optimism/contracts/build/contracts/OVM/bridge/tokens/Abs_L1TokenGateway.sol';
import {iOVM_ERC20} from '@eth-optimism/contracts/build/contracts/iOVM/precompiles/iOVM_ERC20.sol';

// Managed locked funds in L1Escrow and send / receive messages to L2Gateway counterpart
// Note: when bridge is closed it will still process in progress messages

contract L1Gateway is Abs_L1TokenGateway {
  // --- Auth ---
  mapping (address => uint256) public wards;
  function rely(address usr) external auth {
    wards[usr] = 1;
    emit Rely(usr);
  }
  function deny(address usr) external auth {
    wards[usr] = 0;
    emit Deny(usr);
  }
  modifier auth {
    require(wards[msg.sender] == 1, "L1Gateway/not-authorized");
    _;
  }

  event Rely(address indexed usr);
  event Deny(address indexed usr);

  iOVM_ERC20 public immutable l1ERC20;
  address public immutable escrow;
  bool public isOpen = true;

  constructor(
    iOVM_ERC20 _l1ERC20,
    address _l2DepositedERC20,
    address _l1messenger,
    address _escrow
  ) Abs_L1TokenGateway(_l2DepositedERC20, _l1messenger) {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);

    l1ERC20 = _l1ERC20;
    escrow = _escrow;
  }

  // --- Administration ---

  function close() external auth {
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
