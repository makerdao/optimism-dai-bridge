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

import {iOVM_L1ERC20Bridge} from '@eth-optimism/contracts/contracts/optimistic-ethereum/iOVM/bridge/tokens/iOVM_L1ERC20Bridge.sol';
import {OVM_CrossDomainEnabled} from '@eth-optimism/contracts/contracts/optimistic-ethereum/libraries/bridge/OVM_CrossDomainEnabled.sol';

interface TokenLike {
  function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
}

// Managed locked funds in L1Escrow and send / receive messages to L2Gateway counterpart
// Note: when bridge is closed it will still process in progress messages

contract L1Gateway is iOVM_L1ERC20Bridge, OVM_CrossDomainEnabled {
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

  TokenLike public immutable l1ERC20;
  address public immutable l2Gateway;
  address public immutable escrow;
  uint256 public isOpen = 1;

  constructor(
    TokenLike _l1ERC20,
    address _l2Gateway,
    address _l1messenger,
    address _escrow
  ) OVM_CrossDomainEnabled(_l1messenger) { 
    wards[msg.sender] = 1;
    emit Rely(msg.sender);

    l1ERC20 = _l1ERC20;
    l2Gateway = _l2Gateway;
    escrow = _escrow;
  }

  // --- Administration ---

  function close() external auth {
    isOpen = 0;
  }

  // --- Internal methods ---

/**
     * @inheritdoc iOVM_L1ERC20Bridge
     */
    function depositERC20(
        address _l1Token,
        address _l2Token,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    )
        external
        override
        virtual
    {
        _initiateERC20Deposit(l1ERC20, l2Gateway, msg.sender, msg.sender, _amount, _l2Gas, _data);
    }

     /**
     * @inheritdoc iOVM_L1ERC20Bridge
     */
    function depositERC20To(
        address _l1Token,
        address _l2Token,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    )
        external
        override
        virtual
    {
        _initiateERC20Deposit(l1ERC20, l2Gateway, msg.sender, _to, _amount, _l2Gas, _data);
    }

    /**
     * @dev Performs the logic for deposits by informing the L2 Deposited Token
     * contract of the deposit and calling a handler to lock the L1 funds. (e.g. transferFrom)
     *
     * @param _l1Token Address of the L1 ERC20 we are depositing
     * @param _l2Token Address of the L1 respective L2 ERC20
     * @param _from Account to pull the deposit from on L1
     * @param _to Account to give the deposit to on L2
     * @param _amount Amount of the ERC20 to deposit.
     * @param _l2Gas Gas limit required to complete the deposit on L2.
     * @param _data Optional data to forward to L2. This data is provided
     *        solely as a convenience for external contracts. Aside from enforcing a maximum
     *        length, these contracts provide no guarantees about its content.
     */
    function _initiateERC20Deposit(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        uint32 _l2Gas,
        bytes calldata _data
    )
        internal
    {
        require(isOpen == 1, 'L1Gateway/closed');
        l1ERC20.transferFrom(_from, escrow, _amount);

        // Construct calldata for _l2Token.finalizeDeposit(_to, _amount)
        bytes memory message = abi.encodeWithSelector(
            iOVM_L2DepositedToken(_l2Token).finalizeDeposit.selector,
            _l1Token,
            _from,
            _to,
            _amount,
            _data
        );

        // Send calldata into L2
        sendCrossDomainMessage(
            _l2Token,
            _l2Gas,
            message
        );

        // We omit _data here because events only support bytes32 types.
        emit ERC20DepositInitiated(_l1Token, _l2Token, _from, _to, _amount, _data);
    }

    /**
     * @inheritdoc iOVM_L1ERC20Bridge
     */
    function finalizeERC20Withdrawal(
        address /*_l1Token*/,
        address /*_l2Token*/,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    )
        external
        override
        onlyFromCrossDomainAccount(l2Gateway)
    {
        // Transfer withdrawn funds out to withdrawer
        l1ERC20.transferFrom(escrow, _to, _amount);

        emit ERC20WithdrawalFinalized(l1ERC20, l2Gateway, _from, _to, _amount, _data);
    }
}
