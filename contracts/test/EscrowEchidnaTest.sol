// SPDX-License-Identifier: AGPL-3.0-or-later
// @unsupported: ovm
pragma solidity 0.7.6;

import "../l1/L1Escrow.sol";
import "../l2/dai.sol";
import "./l1dai.sol";

/// @dev Escrow Echidna Testing
contract EscrowEchidnaTest {

    L1Dai internal dai;
    L1Escrow internal escrow;
    Dai internal oDai;

    uint256 internal constant chainId = 1;
    uint256 internal constant WAD = 10**18;
    uint256 internal constant MAX_SUPPLY = 10**15 * WAD;

    /// @dev Instantiate the dai, oDai and escrow contract, and set dai allowance
    constructor () {
        dai = new L1Dai(chainId);
        oDai = new Dai();
        escrow = new L1Escrow();
        escrow.approve(address(dai), address(this), type(uint256).max);
        dai.approve(address(this), type(uint256).max);
    }

    // --- Math ---
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x + y;
        assert (z >= x); // check if there is an addition overflow
    }
    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x - y;
        assert (z <= x); // check if there is a subtraction underflow
    }

    /// @dev Test that supply and balance hold on deposit
    function deposit(uint256 wad) public {
        uint256 supply = dai.totalSupply();
        uint256 thisBalance = dai.balanceOf(address(this));
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        wad = wad % MAX_SUPPLY;
        if (wad < WAD) wad = (1 + wad) * WAD;
        dai.mint(address(this), wad);
        assert(dai.balanceOf(address(this)) == add(thisBalance, wad));
        dai.transferFrom(address(this), address(escrow), wad);
        oDai.mint(address(this), wad);
        assert(dai.balanceOf(address(escrow)) == add(escrowBalance, wad));
        assert(oDai.totalSupply() > 0); // sanity check
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }

    /// @dev Test that supply and balance hold on withdraw
    function withdraw(uint256 wad) public {
        uint256 supply = oDai.totalSupply();
        wad = wad % MAX_SUPPLY;
        if (wad < WAD) wad = (1 + wad) * WAD;
        deposit(wad);
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        uint256 thisBalance = dai.balanceOf(address(this));
        oDai.burn(address(this), wad);
        dai.transferFrom(address(escrow), address(this), wad);
        assert(dai.balanceOf(address(escrow)) == sub(escrowBalance, wad));
        assert(dai.balanceOf(address(this)) == add(thisBalance, wad));
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }
}
