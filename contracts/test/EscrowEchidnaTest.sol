// SPDX-License-Identifier: AGPL-3.0-or-later
// @unsupported: ovm
pragma solidity 0.7.6;

import "../l1/L1Escrow.sol";
import "../l2/dai.sol";
import "./l1dai.sol";

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
    Dai internal oDai;
    address alice;

    uint256 internal constant chainId = 1;
    uint256 internal constant WAD = 10**18;
    uint256 internal constant MAX_SUPPLY = 10**15 * WAD;
    address internal constant bob = address(0x42424242);

    /// @dev Instantiate the dai, oDai and escrow contract, and set dai allowance
    constructor () {
        dai = new L1Dai(chainId);
        oDai = new Dai();
        escrow = new L1Escrow();
        escrow.approve(address(dai), address(this), type(uint256).max);
        alice = address(new Alice(address(dai), address(this)));
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

    /// @dev Test that supply and balance hold on mint
    function mint(uint256 wad) public {
        uint256 supply = dai.totalSupply();
        uint256 aliceBalance = dai.balanceOf(alice);
        wad = 1 + wad % sub(MAX_SUPPLY, supply);
        dai.mint(alice, wad);
        assert(dai.balanceOf(alice) == add(aliceBalance, wad));
        assert(dai.totalSupply() == add(supply, wad));
    }

    /// @dev Test that supply and balance hold on burn
    function burn(uint256 wad) public {
        uint256 supply = dai.totalSupply();
        uint256 aliceBalance = dai.balanceOf(alice);
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        dai.burn(alice, wad);
        assert(dai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.totalSupply() == sub(supply, wad));
    }

    /// @dev Test that supply and balance hold on move
    function move(uint256 wad) public {
        uint256 aliceBalance = dai.balanceOf(alice);
        uint256 bobBalance = dai.balanceOf(bob);
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        dai.move(alice, bob, wad);
        assert(dai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.balanceOf(bob) == add(bobBalance, wad));
    }

    /// @dev Test that supply and balance hold on deposit
    function deposit(uint256 wad) public {
        uint256 aliceBalance = dai.balanceOf(alice);
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        dai.transferFrom(alice, address(escrow), wad);
        oDai.mint(alice, wad);
        assert(dai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.balanceOf(address(escrow)) == add(escrowBalance, wad));
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }

    /// @dev Test that supply and balance hold on withdraw
    function withdraw(uint256 wad) public {
        uint256 aliceBalance = oDai.balanceOf(alice);
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        oDai.burn(alice, wad);
        dai.transferFrom(address(escrow), alice, wad);
        assert(dai.balanceOf(address(escrow)) == sub(escrowBalance, wad));
        assert(oDai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }
}
