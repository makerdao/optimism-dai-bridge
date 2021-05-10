// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.7.6;

import "../l2/dai.sol";

/// @dev A contract that will receive Dai, and allows for it to be retrieved.
contract MockHolder {
    constructor (address dai, address usr) public {
        Dai(dai).approve(usr, type(uint256).max);
    }
}

/// @dev Dai Echidna Testing
contract DaiEchidnaTest {

    Dai internal dai;
    address internal holder;

    uint256 internal constant WAD = 10**18;
    uint256 internal constant MAX_SUPPLY = 10**15 * WAD;

    /// @dev Instantiate the Dai contract, and an holder address that will return dai when asked to.
    constructor () public {
        dai = new Dai();
        holder = address(new MockHolder(address(dai), address(this)));
    }

    // --- Math ---
    function add(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x + y;
        assert (z >= x); // check if there is an addition overflow
    }
    function sub(uint256 x, uint256 y) internal pure returns (uint256 z) {
        z = x - y;
        assert (z <= x); // check if there is a subtraction overflow
    }

    /// @dev Test that supply and balance hold on mint
    function mint(uint256 wad) public {
        uint256 supply = dai.totalSupply();
        uint256 holderBalance = dai.balanceOf(holder);
        wad = wad % sub(MAX_SUPPLY, supply);
        if (wad < WAD) wad = (1 + wad) * WAD;
        dai.mint(holder, wad);
        assert(dai.balanceOf(holder) == add(holderBalance, wad));
        assert(dai.totalSupply() == add(supply, wad));
    }

    /// @dev Test that supply and balance hold on burn
    function burn(uint256 wad) public {
        uint256 holderBalance = dai.balanceOf(holder);
        wad = 1 + wad % holderBalance;
        dai.burn(holder, wad);
        assert(dai.balanceOf(holder) == sub(holderBalance, wad));
        assert(dai.totalSupply() == sub(supply, wad));
    }

    /// @dev Test that supply and balance hold on transfer.
    function transfer(uint256 wad) public {
        uint256 thisBalance = dai.balanceOf(address(this));
        uint256 holderBalance = dai.balanceOf(holder);
        wad = 1 + wad % thisBalance;
        dai.transfer(holder, wad);
        assert(dai.balanceOf(address(this)) == sub(thisBalance, wad));
        assert(dai.balanceOf(holder) == add(holderBalance, wad));
    }

    /// @dev Test that supply and balance hold on transferFrom.
    function transferFrom(uint256 wad) public {
        uint256 thisBalance = dai.balanceOf(address(this));
        uint256 holderBalance = dai.balanceOf(holder);
        uint256 supply = dai.totalSupply();
        wad = wad % sub(MAX_SUPPLY, supply);
        if (wad < WAD) wad = (1 + wad) * WAD;
        dai.transferFrom(holder, address(this), wad);
        assert(dai.balanceOf(holder) == sub(holderBalance, wad));
        assert(dai.balanceOf(address(this)) == add(thisBalance, wad));
    }
}
