// SPDX-License-Identifier: AGPL-3.0-or-later
// @unsupported: ovm
pragma solidity 0.7.6;

import "../l1/L1Escrow.sol";
import "../l1/L1Gateway.sol";
import "../l2/L2Gateway.sol";
import "../l2/dai.sol";
import "./l1dai.sol";
import "@eth-optimism/contracts/iOVM/bridge/messaging/iAbs_BaseCrossDomainMessenger.sol";

contract MockMessenger is iAbs_BaseCrossDomainMessenger {
  function xDomainMessageSender()
    public
    override
    view
    returns (address)
  {
    require(false, "not implemented");
  }
  function sendMessage(
    address _target,
    bytes calldata _message,
    uint32 _gasLimit
  ) external override {
      (bool success,) = _target.call(_message);
  }
}

/// @dev Escrow Echidna Testing
contract EscrowEchidnaTest is MockMessenger {

    L1Dai internal dai;
    L1Escrow internal escrow;
    MockMessenger internal messenger;
    L2Gateway internal gate2;
    L1Gateway internal gate1;
    Dai internal oDai;

    uint256 internal constant chainId = 1;
    uint256 internal constant WAD = 10**18;
    uint256 internal constant MAX_SUPPLY = 10**15 * WAD;

    /// @dev
    constructor () {
        dai = new L1Dai(chainId);
        oDai = new Dai();
        escrow = new L1Escrow();
        messenger = new MockMessenger();
        gate2 = new L2Gateway(address(messenger), address(oDai));
        gate1 = new L1Gateway(address(dai), address(gate2), address(messenger), address(escrow));
        gate2.init(gate1);
        escrow.approve(address(dai), address(gate1), type(uint256).max);
        dai.approve(address(gate1), type(uint256).max);
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

    /// @dev
    function deposit(uint256 wad) public {
        uint256 supply = dai.totalSupply();
        uint256 thisBalance = dai.balanceOf(address(this));
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        wad = 1 + wad % sub(MAX_SUPPLY, supply);
        dai.mint(address(this), wad);
        assert(dai.balanceOf(address(this)) == add(thisBalance, wad));
        gate1.deposit(wad);
        assert(dai.balanceOf(address(escrow)) == add(escrowBalance, wad));
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }
    function withdraw(uint256 wad) public {
        deposit(wad);
        uint256 supply = oDai.totalSupply();
        wad = 1 + wad % sub(MAX_SUPPLY, supply);
        uint256 escrowBalance = dai.balanceOf(address(escrow));
        uint256 thisBalance = dai.balanceOf(address(this));
        gate2.withdraw(wad);
        assert(dai.balanceOf(address(escrow)) == sub(escrowBalance, wad));
        assert(dai.balanceOf(address(this)) == add(thisBalance, wad));
        assert(dai.balanceOf(address(escrow)) == oDai.totalSupply());
    }
}
