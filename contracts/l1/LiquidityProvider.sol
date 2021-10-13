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

    enum WithdrawalStatus { PENDING, SENT_TO_USER, CLAIMED }

    address public immutable owner = msg.sender; // TODO: add wards
    MessengerLike public immutable l1Messenger;
    mapping (bytes32 => WithdrawalStatus) withdrawals;
    mapping (address => address) l1Bridges; // l1Token => l1Bridge
    mapping (address => address) l2Bridges; // l2Token => l2Bridge

    constructor(MessengerLike _l1messenger) {
        l1Messenger = _l1messenger;
    }

    modifier onlyOwner {
        require(msg.sender == owner, "not owner");
        _;
    }

    function registerL1Token(address _l1Token, address _l1Bridge) external onlyOwner {
        // l1Token => l1Bridge mapping should be immutable, otherwise LP could deny claim() by user
        require(l1Bridges[_l1Token] == address(0), "l1Token already registered");
        l1Bridges[_l1Token] = _l1Bridge;
    }

    function registerL2Token(address _l2Token, address _l2Bridge) external onlyOwner {
        // l2Token => l2Bridge mapping should be immutable, otherwise LP could deny claim() by user
        require(l2Bridges[_l2Token] == address(0), "l2Token already registered");
        l2Bridges[_l2Token] = _l2Bridge;
    }

    function processFastWithdrawal(
        address _l1Token,
        address _inventory,
        address _recipient,
        uint256 _amount,
        uint256 _fee,
        uint256 _messageNonce
    ) external onlyOwner {
        bytes32 withdrawalId = getWithdrawalId(_l1Token, _recipient, _amount, _fee, _messageNonce);
        require(withdrawals[withdrawalId] == WithdrawalStatus.PENDING, "already sent");
        withdrawals[withdrawalId] = WithdrawalStatus.SENT_TO_USER;

        // TODO: use SafeERC20.safeTransferFrom
        TokenLike(_l1Token).transferFrom(_inventory, _recipient, _sub(_amount, _fee));
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
        require(wasWithdrawn(_l1Token, _l2Token, _sender, _recipient, _amount, _fee, _messageNonce), "not withdrawn");
        bytes32 withdrawalId = getWithdrawalId(_l1Token, _recipient, _amount, _fee, _messageNonce);
        WithdrawalStatus status = withdrawals[withdrawalId];
        require(status != WithdrawalStatus.CLAIMED, "already claimed");
        address to;
        if(status == WithdrawalStatus.PENDING) {
            to = _recipient;
        } else {
            to = owner;
        }
        withdrawals[withdrawalId] = WithdrawalStatus.CLAIMED;
        TokenLike(_l1Token).transfer(to, _amount); // TODO: use SafeERC20.safeTransferFrom
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
            data);
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
        require((z = x - y) <= x, "ds-math-sub-underflow");
    }
}