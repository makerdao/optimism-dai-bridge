// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
pragma solidity >=0.7.6;

import {Abs_L2DepositedToken} from '@eth-optimism/contracts/build/contracts/OVM/bridge/tokens/Abs_L2DepositedToken.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

interface Mintable {
  function mint(address usr, uint256 wad) external;

  function burn(address usr, uint256 wad) external;
}

// Mint tokens on L2 after locking funds on L1.
// Burn tokens on L1 and send a message to unlock tokens on L1 to L1 counterpart
// Note: when bridge is closed it will still process in progress messages

contract L2DepositedToken is Abs_L2DepositedToken, Ownable {
  Mintable public token;
  bool public isOpen = true;

  constructor(address _l2CrossDomainMessenger, address _token) public Abs_L2DepositedToken(_l2CrossDomainMessenger) {
    token = Mintable(_token);
  }

  function close() public onlyOwner {
    isOpen = false;
  }

  // When a withdrawal is initiated, we burn the withdrawer's funds to prevent subsequent L2 usage.
  function _handleInitiateWithdrawal(address _to, uint256 _amount) internal override {
    // do not allow initiaitng new xchain messages if bridge is closed
    require(isOpen, 'L2DepositedToken/closed');
    token.burn(msg.sender, _amount);
  }

  // When a deposit is finalized, we credit the account on L2 with the same amount of tokens.
  function _handleFinalizeDeposit(address _to, uint256 _amount) internal override {
    token.mint(_to, _amount);
  }
}
