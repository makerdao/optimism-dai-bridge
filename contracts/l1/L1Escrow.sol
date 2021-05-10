// SPDX-License-Identifier: MIT
// Copyright (C) 2021 Dai Foundation
// @unsupported: ovm
pragma solidity >0.5.0 <0.8.0;

interface ApproveLike {
  function approve(address, uint256) external;
}

contract L1Escrow {
    
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
    require(wards[msg.sender] == 1, "L1Escrow/not-authorized");
    _;
  }

  event Rely(address indexed usr);
  event Deny(address indexed usr);
  
  constructor() {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);
  }

  function approve(
    address token,
    address spender,
    uint256 value
  ) public auth {
    ApproveLike(token).approve(spender, value);
  }
}
