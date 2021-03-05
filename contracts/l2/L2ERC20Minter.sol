// SPDX-License-Identifier: MIT
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

/* Library Imports */
import {Abs_L2DepositedToken} from '@eth-optimism/contracts/build/contracts/OVM/bridge/tokens/Abs_L2DepositedToken.sol';

interface Mintable {
  function mint(address usr, uint256 wad) external;

  function burn(address usr, uint256 wad) external;
}

contract L2ERC20Minter is Abs_L2DepositedToken {
  Mintable public token;

  /***************
   * Constructor *
   ***************/

  /**
   * @param _l2CrossDomainMessenger Cross-domain messenger used by this contract.
   * @param _token address
   */
  constructor(address _l2CrossDomainMessenger, address _token) public Abs_L2DepositedToken(_l2CrossDomainMessenger) {
    token = Mintable(_token);
  }

  // When a withdrawal is initiated, we burn the withdrawer's funds to prevent subsequent L2 usage.
  function _handleInitiateWithdrawal(address _to, uint256 _amount) internal override {
    token.burn(msg.sender, _amount);
  }

  // When a deposit is finalized, we credit the account on L2 with the same amount of tokens.
  function _handleFinalizeDeposit(address _to, uint256 _amount) internal override {
    token.mint(_to, _amount);
  }
}
