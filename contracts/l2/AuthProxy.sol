// SPDX-License-Identifier: MIT
// Copyright (C) 2021 Dai Foundation
pragma solidity >0.5.0 <0.8.0;
pragma experimental ABIEncoderV2;

contract AuthProxy {
    
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
    require(wards[msg.sender] == 1, "AuthProxy/not-authorized");
    _;
  }

  event Rely(address indexed usr);
  event Deny(address indexed usr);

  constructor() {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);
  }

  function exec(address target, bytes memory data) external auth returns (bytes memory out) {
      bool ok;
      (ok, out) = target.delegatecall(data);
      require(ok, "AuthProxy/delegatecall-error");
  }
}
