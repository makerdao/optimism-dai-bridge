// SPDX-License-Identifier: AGPL-3.0-or-later
// @unsupported: ovm
pragma solidity 0.7.6;

import "../l1/L1Escrow.sol";
import "../l1/L1DAITokenBridge.sol";
import "../l2/L2DAITokenBridge.sol";
import "../l2/dai.sol";
import "./l1dai.sol";
import "@eth-optimism/contracts/iOVM/bridge/messaging/iOVM_CrossDomainMessenger.sol";

contract MockMessenger is iOVM_CrossDomainMessenger {
  function xDomainMessageSender()
    public
    override
    view
    returns (address)
  {
    return address(0x41414141);
  }
  function sendMessage(
    address _target,
    bytes calldata _message,
    uint32 _gasLimit
  ) external override {
      (bool success,) = _target.call(_message);
      require(success);
  }
}

/// @dev A contract that will receive Dai, and allows for it to be retrieved.
contract Alice {
    constructor (address dai, address usr) public {
        Dai(dai).approve(usr, type(uint256).max);
    }
}

/// @dev Escrow Echidna Testing
contract EscrowEchidnaTest {

    L1Dai internal dai;
    L1Escrow internal escrow;
    MockMessenger internal messenger;
    L1DAITokenBridge internal bridge1;
    L2DAITokenBridge internal bridge2;
    Dai internal oDai;
    address nonce6;
    address alice;

    uint256 internal constant chainId = 1;
    uint256 internal constant WAD = 10**18;
    uint256 internal constant MAX_SUPPLY = 10**15 * WAD;
    uint32 internal constant GAS_LIMIT = 1_000_000;
    address internal constant bob = address(0x42424242);

    /// @dev Instantiate the dai, oDai and escrow contract, and set dai allowance
    /// @dev nonce6 twist require echidna version > 1.7.1 with hevm v.0.46.0 support
    constructor () {
        dai = new L1Dai(chainId); //nonce 1
        oDai = new Dai(); // nonce 2
        oDai.rely(address(bridge2));
        escrow = new L1Escrow(); // nonce 3
        messenger = new MockMessenger(); // nonce 4
        nonce6 = address(uint160(uint256(keccak256(abi.encodePacked(byte(0xd6), byte(0x94), address(this), byte(0x06))))));
        bridge1 = new L1DAITokenBridge(address(dai), nonce6, address(oDai), address(messenger), address(escrow));
        bridge2 = new L2DAITokenBridge(address(messenger), address(oDai), address(dai), address(bridge1));
        assert(nonce6 == address(bridge2));
        alice = address(new Alice(address(dai), address(this)));
        escrow.approve(address(dai), address(this), type(uint256).max);
    }

    // --- Math ---
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x + y;
        assert (z >= x); // check for addition overflow
    }
    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x - y;
        assert (z <= x); // check for subtraction underflow
    }

    /// @dev Test that Dai supply and balance hold on mint
    function mint(uint256 wad) public {
        uint256 supply = dai.totalSupply();
        uint256 aliceBalance = dai.balanceOf(alice);
        wad = 1 + wad % sub(MAX_SUPPLY, supply);
        dai.mint(alice, wad);
        assert(dai.balanceOf(alice) == add(aliceBalance, wad));
        assert(dai.totalSupply() == add(supply, wad));
    }

    /// @dev Test that Dai supply and balance hold on burn
    function burn(uint256 wad) public {
        uint256 supply = dai.totalSupply();
        uint256 aliceBalance = dai.balanceOf(alice);
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        dai.burn(alice, wad);
        assert(dai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.totalSupply() == sub(supply, wad));
    }

    /// @dev Test that alice and bob balances hold on move
    function move(uint256 wad) public {
        uint256 aliceBalance = dai.balanceOf(alice);
        uint256 bobBalance = dai.balanceOf(bob);
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        dai.move(alice, bob, wad);
        assert(dai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.balanceOf(bob) == add(bobBalance, wad));
    }

    /// @dev Test that oDai supply and Escrow balance hold on deposit
    function deposit(uint256 wad) public {
        uint256 aliceBalance = dai.balanceOf(alice);
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        bridge1.depositERC20To(address(dai), address(oDai), alice, wad, GAS_LIMIT, "");
        assert(dai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.balanceOf(address(escrow)) == add(escrowBalance, wad));
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }

    /// @dev Test that oDai supply and Escrow balance hold on withdraw
    function withdraw(uint256 wad) public {
        uint256 aliceBalance = oDai.balanceOf(alice);
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        bridge2.withdraw(address(oDai), wad, GAS_LIMIT, "");
        assert(dai.balanceOf(address(escrow)) == sub(escrowBalance, wad));
        assert(oDai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }
}
