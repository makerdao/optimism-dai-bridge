pragma solidity ^0.5.0;

import {IERC20} from './ERC20.interface.sol';
import {
  iOVM_BaseCrossDomainMessenger
} from '@eth-optimism/contracts/build/contracts/iOVM/bridge/iOVM_BaseCrossDomainMessenger.sol';

contract L1ERC20Deposit {
  address l2ERC20Address;
  IERC20 l1ERC20;
  iOVM_BaseCrossDomainMessenger internal messenger;

  constructor(
    address _L1ERC20Address,
    address _L2ERC20Address,
    address _messenger
  ) public {
    l1ERC20 = IERC20(_L1ERC20Address);
    l2ERC20Address = _L2ERC20Address;
    messenger = iOVM_BaseCrossDomainMessenger(_messenger);
  }

  function deposit(address _depositer, uint256 _amount) public {
    l1ERC20.transferFrom(_depositer, address(this), _amount);

    // Generate encoded calldata to be executed on L2.
    bytes memory message = abi.encodeWithSignature('mint(address,uint256)', _depositer, _amount);
    messenger.sendMessage(l2ERC20Address, message, 1000000); //TODO: meter this, find a lower-bounded value
  }

  function withdraw(address _withdrawer, uint256 _amount) public {
    require(l2ERC20Address == messenger.xDomainMessageSender());
    require(msg.sender == address(messenger), 'Only messages relayed by the L1CrossDomainMessenger can withdraw');
    l1ERC20.transfer(_withdrawer, _amount);
  }
}
