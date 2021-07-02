// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.6;

import "../l2/dai.sol";

/// @dev A contract that will receive Dai, and allows for it to be retrieved.
contract Alice {
    constructor (address dai, address usr) public {
        Dai(dai).approve(usr, type(uint256).max);
    }
}

/// @dev Dai Echidna Testing
contract DaiEchidnaTest {

    Dai internal dai;
    address internal alice;

    uint256 internal constant WAD = 10**18;
    uint256 internal constant MAX_SUPPLY = 10**15 * WAD;

    /// @dev Instantiate the Dai contract, and alice address that will return dai when asked to.
    constructor () public {
        dai = new Dai();
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

    /// @dev Test that supply and balance hold on transfer
    function transfer(uint256 wad) public {
        uint256 thisBalance = dai.balanceOf(address(this));
        uint256 aliceBalance = dai.balanceOf(alice);
        wad = thisBalance == 0 ? 0 : 1 + wad % thisBalance;
        dai.transfer(alice, wad);
        assert(dai.balanceOf(address(this)) == sub(thisBalance, wad));
        assert(dai.balanceOf(alice) == add(aliceBalance, wad));
    }

    /// @dev Test that supply and balance hold on transferFrom
    function transferFrom(uint256 wad) public {
        uint256 aliceBalance = dai.balanceOf(alice);
        uint256 thisBalance = dai.balanceOf(address(this));
        wad = aliceBalance == 0 ? 0 : 1 + wad % aliceBalance;
        dai.transferFrom(alice, address(this), wad);
        assert(dai.balanceOf(alice) == sub(aliceBalance, wad));
        assert(dai.balanceOf(address(this)) == add(thisBalance, wad));
    }
}
