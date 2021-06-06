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

import {iOVM_L1ERC20Bridge} from '@eth-optimism/contracts/contracts/optimistic-ethereum/iOVM/bridge/tokens/iOVM_L1ERC20Bridge.sol';
import {iOVM_L2ERC20Bridge} from '@eth-optimism/contracts/contracts/optimistic-ethereum/iOVM/bridge/tokens/iOVM_L2ERC20Bridge.sol';
import {OVM_CrossDomainEnabled} from '@eth-optimism/contracts/contracts/optimistic-ethereum/libraries/bridge/OVM_CrossDomainEnabled.sol';

interface Mintable {
  function mint(address usr, uint256 wad) external;

  function burn(address usr, uint256 wad) external;
}

// Mint tokens on L2 after locking funds on L1.
// Burn tokens on L1 and send a message to unlock tokens on L1 to L1 counterpart
// Note: when bridge is closed it will still process in progress messages

contract L2Gateway is iOVM_L2ERC20Bridge, OVM_CrossDomainEnabled {
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
  address l1Gateway;
  address l1Token;

  constructor(address _l2CrossDomainMessenger, address _token) public OVM_CrossDomainEnabled(_l2CrossDomainMessenger) {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);

    token = Mintable(_token);
  }

  function init(address _l1Gateway, address _l1Token) external auth {
    require(_l1Token != address(0)); 

    l1Gateway = _l1Gateway;
    l1Token = _l1Token;
  }

  function close() external auth {
    isOpen = 0;
  }

  function withdraw(
        address _l2Token,
        uint256 _amount,
        uint32, // _l1Gas, @todo why empty?
        bytes calldata _data
    )
        external
        override
        virtual
    {
        _initiateWithdrawal(
            _l2Token,
            msg.sender,
            msg.sender,
            _amount,
            0,
            _data
        );
    }

    function withdrawTo(
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32, // _l1Gas,
        bytes calldata _data
    )
        external
        override
        virtual
    {
        _initiateWithdrawal(
            _l2Token,
            msg.sender,
            _to,
            _amount,
            0,
            _data
        );
    }

  // When a withdrawal is initiated, we burn the withdrawer's funds to prevent subsequent L2 usage.
  function _initiateWithdrawal(
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        uint32, // _l1Gas,
        bytes calldata _data
    )
        internal
    {
    // do not allow initiaitng new xchain messages if bridge is closed
    require(isOpen == 1, 'L2Gateway/closed');
    token.burn(msg.sender, _amount);

    address l1Token = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE; // @todo? save l1 token in constructor?

    bytes memory message = abi.encodeWithSelector(
        iOVM_L1ERC20Bridge.finalizeERC20Withdrawal.selector,
        l1Token,
        _l2Token,
        _from,
        _to,
        _amount,
        _data
    );

    // Send message up to L1 bridge
    sendCrossDomainMessage(
        l1Gateway,
        0,
        message
    );

    emit WithdrawalInitiated(l1Token, _l2Token, msg.sender, _to, _amount, _data);
  }

  // When a deposit is finalized, we credit the account on L2 with the same amount of tokens.
  function finalizeDeposit(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) 
    external
    override
    virtual
    onlyFromCrossDomainAccount(l1Gateway)
  {
    // @todo: ensure that l2token is _token
    token.mint(_to, _amount);

    emit DepositFinalized(_l1Token, _l2Token, _from, _to, _amount, _data);
  }
}
