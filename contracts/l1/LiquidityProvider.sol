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

interface TokenLike {
  function transferFrom(address _from, address _to, uint256 _value) external returns (bool success);
  function transfer(address _to, uint256 _value) external returns (bool success);
}

interface MessengerLike {
    function successfulMessages(bytes32) external view returns (bool);
}

interface L1ERC20BridgeLike {
    function finalizeERC20Withdrawal(
        address _l1Token,
        address _l2Token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external;
}

contract LiquidityProvider {

    event Rely(address indexed usr);
    event Deny(address indexed usr);

    enum WithdrawalStatus { PENDING, SENT_TO_USER, CLAIMED }

    MessengerLike public immutable l1Messenger;
    address public inventory = msg.sender;

    mapping (address => uint256) public wards;
    mapping (bytes32 => WithdrawalStatus) withdrawals;
    mapping (address => address) l1Bridges; // l1Token => l1Bridge
    mapping (address => address) l2Bridges; // l2Token => l2Bridge

    constructor(MessengerLike _l1messenger) {
        l1Messenger = _l1messenger;
        wards[msg.sender] = 1;
        emit Rely(msg.sender);
    }

    modifier auth {
        require(wards[msg.sender] == 1, "LiquidityProvider/not-authorized");
        _;
    }

    function rely(address usr) external auth {
        wards[usr] = 1;
        emit Rely(usr);
    }

    function deny(address usr) external auth {
        wards[usr] = 0;
        emit Deny(usr);
    }

    function registerL1Token(address _l1Token, address _l1Bridge) external auth {
        // l1Token => l1Bridge mapping should be immutable, otherwise LP could deny claim() by user
        require(l1Bridges[_l1Token] == address(0), "LiquidityProvider/already-registered");
        l1Bridges[_l1Token] = _l1Bridge;
    }

    function registerL2Token(address _l2Token, address _l2Bridge) external auth {
        // l2Token => l2Bridge mapping should be immutable, otherwise LP could deny claim() by user
        require(l2Bridges[_l2Token] == address(0), "LiquidityProvider/already-registered");
        l2Bridges[_l2Token] = _l2Bridge;
    }

    function setInventory(address _inventory) external auth {
        inventory = _inventory;
    }

    function processFastWithdrawal(
        address _l1Token,
        address _recipient,
        uint256 _amount,
        uint256 _fee,
        uint256 _messageNonce
    ) external auth {
        bytes32 withdrawalId = getWithdrawalId(_l1Token, _recipient, _amount, _fee, _messageNonce);
        require(withdrawals[withdrawalId] == WithdrawalStatus.PENDING, "LiquidityProvider/already-sent");
        withdrawals[withdrawalId] = WithdrawalStatus.SENT_TO_USER;
        require(TokenLike(_l1Token).transferFrom(inventory, _recipient, _sub(_amount, _fee)), "LiquidityProvider/transfer-failed");
    }

    function claim(
        address _l1Token,
        address _l2Token,
        address _sender,
        address _recipient,
        uint256 _amount,
        uint256 _fee,
        uint256 _messageNonce
    ) external {
        require(wasWithdrawn(_l1Token, _l2Token, _sender, _recipient, _amount, _fee, _messageNonce), "LiquidityProvider/not-withdrawn");
        bytes32 withdrawalId = getWithdrawalId(_l1Token, _recipient, _amount, _fee, _messageNonce);
        WithdrawalStatus status = withdrawals[withdrawalId];
        require(status != WithdrawalStatus.CLAIMED, "LiquidityProvider/already-claimed");
        address to = (status == WithdrawalStatus.PENDING) ? _recipient : inventory;
        withdrawals[withdrawalId] = WithdrawalStatus.CLAIMED;
        require(TokenLike(_l1Token).transfer(to, _amount), "LiquidityProvider/transfer-failed");
    }

    function wasWithdrawn(
        address _l1Token,
        address _l2Token,
        address _sender,
        address _recipient,
        uint256 _amount,
        uint256 _fee,
        uint256 _messageNonce
    ) public view returns (bool) {
        bytes memory data = abi.encode(_recipient, _fee);
        bytes memory call = abi.encodeWithSelector(L1ERC20BridgeLike.finalizeERC20Withdrawal.selector, 
            _l1Token,
            _l2Token,
            _sender,
            address(this),
            _amount,
            data
        );
        bytes memory message = abi.encodeWithSignature(
            "relayMessage(address,address,bytes,uint256)",
            l1Bridges[_l1Token], // target
            l2Bridges[_l2Token], // sender
            call,
            _messageNonce // l2 nonce
        );
        return l1Messenger.successfulMessages(keccak256(message));
    }

    function getWithdrawalId(        
        address _l1Token,
        address _recipient,
        uint256 _amount,
        uint256 _fee,
        uint256 _messageNonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_l1Token, _recipient, _amount, _fee, _messageNonce));
    }

    function _sub(uint x, uint y) internal pure returns (uint z) {
        require((z = x - y) <= x, "LiquidityProvider/ds-math-sub-underflow");
    }
}