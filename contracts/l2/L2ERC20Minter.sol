pragma solidity ^0.5.0;

interface iOVM_BaseCrossDomainMessenger {
  function xDomainMessageSender() external view returns (address);

  function sendMessage(
    address _target,
    bytes calldata _message,
    uint32 _gasLimit
  ) external;
}

interface Mintable {
  function mint(address usr, uint256 wad) external;

  function burn(address usr, uint256 wad) external;
}

contract L2ERC20Minter {
  address l1ERC20DepositAddress;
  iOVM_BaseCrossDomainMessenger internal messenger;
  Mintable token;

  constructor(address _token) public {
    token = Mintable(_token);
  }

  function init(address _messenger, address _L1ERC20DepositAddress) public {
    require(l1ERC20DepositAddress == address(0), 'L2ERC20 instance has already been initalized');
    messenger = iOVM_BaseCrossDomainMessenger(_messenger);
    l1ERC20DepositAddress = _L1ERC20DepositAddress;
  }

  function mint(address _depositor, uint256 _amount) public returns (bool success) {
    require(messenger.xDomainMessageSender() == l1ERC20DepositAddress);
    require(msg.sender == address(messenger), 'Only messages relayed by L2CrossDomainMessenger can mint');
    token.mint(_depositor, _amount);
    return true;
  }

  function withdraw(uint256 _amount) public {
    token.burn(msg.sender, _amount);
    // generate encoded calldata to be executed on L1
    bytes memory message = abi.encodeWithSignature('withdraw(address,uint256)', msg.sender, _amount);

    // send the message over to the L1CrossDomainMessenger!
    messenger.sendMessage(l1ERC20DepositAddress, message, 1000000);
  }
}
