// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2017, 2018, 2019 dbrock, rain, mrchico
// Copyright (C) 2021 MakerDAO

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

pragma solidity 0.7.6;

interface IERC3156FlashBorrower {

    /**
     * @dev Receive a flash loan.
     * @param initiator The initiator of the loan.
     * @param token The loan currency.
     * @param amount The amount of tokens lent.
     * @param fee The additional amount of tokens to repay.
     * @param data Arbitrary data structure, intended to contain user-defined parameters.
     * @return The keccak256 hash of "ERC3156FlashBorrower.onFlashLoan"
     */
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);

}

contract Dai {
    
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
    require(wards[msg.sender] == 1, "Dai/not-authorized");
    _;
  }

  // --- ERC20 Data ---
  string  public constant name     = "Dai Stablecoin";
  string  public constant symbol   = "DAI";
  string  public constant version  = "2";
  uint8   public constant decimals = 18;
  uint256 public totalSupply;

  mapping (address => uint256)                      public balanceOf;
  mapping (address => mapping (address => uint256)) public allowance;
  mapping (address => uint256)                      public nonces;

  event Approval(address indexed src, address indexed guy, uint256 wad);
  event Transfer(address indexed src, address indexed dst, uint256 wad);
  event Rely(address indexed usr);
  event Deny(address indexed usr);
  event FlashLoan(address indexed receiver, uint256 amount);

  // --- Math ---
  function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
    require((z = x + y) >= x);
  }
  function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
    require((z = x - y) <= x);
  }

  uint256 private locked;
  modifier lock {
    require(locked == 0, "Dai/reentrancy-guard");
    locked = 1;
    _;
    locked = 0;
  }

  bytes32 public constant CALLBACK_SUCCESS = keccak256("ERC3156FlashBorrower.onFlashLoan");

  // --- EIP712 niceties ---
  bytes32 public immutable DOMAIN_SEPARATOR;
  bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

  constructor() {
    wards[msg.sender] = 1;
    emit Rely(msg.sender);

    uint256 chainId;
    assembly {chainId := chainid()}
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256(bytes(name)),
      keccak256(bytes(version)),
      chainId,
      address(this)
    ));

    // Set addresses which disallow transfer
    balanceOf[address(this)] = balanceOf[address(0)] = type(uint256).max;
  }

  // --- ERC20 Mutations ---
  function transfer(address dst, uint256 wad) external returns (bool) {
    return transferFrom(msg.sender, dst, wad);
  }
  function transferFrom(address src, address dst, uint256 wad) public returns (bool) {
    require(balanceOf[src] >= wad, "Dai/insufficient-balance");

    if (src != msg.sender && allowance[src][msg.sender] != type(uint256).max) {
        require(allowance[src][msg.sender] >= wad, "Dai/insufficient-allowance");

        allowance[src][msg.sender] = sub(allowance[src][msg.sender], wad);
    }

    balanceOf[src] = sub(balanceOf[src], wad);
    balanceOf[dst] = add(balanceOf[dst], wad);

    emit Transfer(src, dst, wad);

    return true;
  }
  function approve(address usr, uint256 wad) external returns (bool) {
    allowance[msg.sender][usr] = wad;

    emit Approval(msg.sender, usr, wad);

    return true;
  }
  
  // --- Mint/Burn ---
  function mint(address usr, uint256 wad) external auth {
    _mint(usr, wad);
  }
  function _mint(address usr, uint256 wad) internal {
    balanceOf[usr] = add(balanceOf[usr], wad);
    totalSupply    = add(totalSupply, wad);

    emit Transfer(address(0), usr, wad);
  }
  function burn(address usr, uint256 wad) public {
    require(balanceOf[usr] >= wad, "Dai/insufficient-balance");

    if (usr != msg.sender && allowance[usr][msg.sender] != type(uint256).max) {
      require(allowance[usr][msg.sender] >= wad, "Dai/insufficient-allowance");

      allowance[usr][msg.sender] = sub(allowance[usr][msg.sender], wad);
    }

    balanceOf[usr] = sub(balanceOf[usr], wad);
    totalSupply    = sub(totalSupply, wad);

    emit Transfer(usr, address(0), wad);
  }

  // --- Approve by signature ---
  function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external {
    require(block.timestamp <= deadline, "Dai/permit-expired");
    require(owner != address(0), "Dai/permit-expired");

    bytes32 digest =
      keccak256(abi.encodePacked(
          "\x19\x01",
          DOMAIN_SEPARATOR,
          keccak256(abi.encode(
            PERMIT_TYPEHASH,
            owner,
            spender,
            value,
            nonces[owner]++,
            deadline
          ))
      ));

    require(owner != address(0) && owner == ecrecover(digest, v, r, s), "Dai/invalid-permit");

    allowance[owner][spender] = value;
    emit Approval(owner, spender, value);
  }

  // --- ERC 3156 Spec ---
  function maxFlashLoan(
    address token
  ) external view returns (uint256) {
    if (token == address(this) && locked == 0) {
      return type(uint112).max;
    } else {
      return 0;
    }
  }
  function flashFee(
    address token,
    uint256
  ) external view returns (uint256) {
    require(token == address(this), "Dai/token-unsupported");

    return 0;
  }
  function flashLoan(
    address receiver,
    address token,
    uint256 amount,
    bytes calldata data
  ) external lock returns (bool) {
    require(token == address(this), "Dai/token-unsupported");
    require(amount <= type(uint112).max, "Dai/ceiling-exceeded");

    _mint(receiver, amount);

    emit FlashLoan(address(receiver), amount);

    require(
      IERC3156FlashBorrower(receiver).onFlashLoan(msg.sender, token, amount, 0, data) == CALLBACK_SUCCESS,
      "Dai/callback-failed"
    );
    
    burn(receiver, amount);

    return true;
  }

}
