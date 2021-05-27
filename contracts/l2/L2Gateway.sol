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

import {Abs_L2DepositedToken} from '@eth-optimism/contracts/OVM/bridge/tokens/Abs_L2DepositedToken.sol';

interface Mintable {
  function mint(address usr, uint256 wad) external;

  function burn(address usr, uint256 wad) external;
}

// Mint tokens on L2 after locking funds on L1.
// Burn tokens on L1 and send a message to unlock tokens on L1 to L1 counterpart
// Note: when bridge is closed it will still process in progress messages

contract L2Gateway is Abs_L2DepositedToken {
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
    require(wards[msg.sender] == 1, "L2Gateway/not-authorized");
    _;
  }

  event Rely(address indexed usr);
  event Deny(address indexed usr);

  Mintable public immutable token;
  uint256 public isOpen = 1;

  constructor(address _l2CrossDomainMessenger, address _token) public Abs_L2DepositedToken(_l2CrossDomainMessenger) {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);

    token = Mintable(_token);
  }

  function close() external auth {
    isOpen = 0;
  }

  // When a withdrawal is initiated, we burn the withdrawer's funds to prevent subsequent L2 usage.
  function _handleInitiateWithdrawal(address _to, uint256 _amount) internal override {
    // do not allow initiaitng new xchain messages if bridge is closed
    require(isOpen == 1, 'L2Gateway/closed');
    token.burn(msg.sender, _amount);
  }

  // When a deposit is finalized, we credit the account on L2 with the same amount of tokens.
  function _handleFinalizeDeposit(address _to, uint256 _amount) internal override {
    token.mint(_to, _amount);
  }
}
