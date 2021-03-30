// SPDX-License-Identifier: MIT
// Copyright (C) 2021 Dai Foundation
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

import {Abs_L2DepositedToken} from '@eth-optimism/contracts/build/contracts/OVM/bridge/tokens/Abs_L2DepositedToken.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';

import {AuthProxy} from './AuthProxy.sol';

interface Mintable {
  function mint(address usr, uint256 wad) external;

  function burn(address usr, uint256 wad) external;
}

contract L2DepositedToken is Abs_L2DepositedToken, Ownable {
  Mintable public token;
  AuthProxy public proxy;
  bool public isOpen = true;

  /***************
   * Constructor *
   ***************/

  /**
   * @param _l2CrossDomainMessenger Cross-domain messenger used by this contract.
   * @param _token address
   */
  constructor(address _l2CrossDomainMessenger, address _token, address _proxy) public Abs_L2DepositedToken(_l2CrossDomainMessenger) {
    token = Mintable(_token);
    proxy = AuthProxy(_proxy);
  }

  function close() public onlyOwner {
    isOpen = false;
  }

  // When a withdrawal is initiated, we burn the withdrawer's funds to prevent subsequent L2 usage.
  function _handleInitiateWithdrawal(address _to, uint256 _amount) internal override {
    require(isOpen, 'L2DepositedToken/closed');
    token.burn(msg.sender, _amount);
  }

  // When a deposit is finalized, we credit the account on L2 with the same amount of tokens.
  function _handleFinalizeDeposit(address _to, uint256 _amount) internal override {
    token.mint(_to, _amount);
  }
}
