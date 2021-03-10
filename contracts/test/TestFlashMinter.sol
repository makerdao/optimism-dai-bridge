// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.6;

import '../l2/dai.sol';

contract TestFlashLender {
    enum Action {NORMAL, STEAL, REENTER}

    uint256 public flashBalance;
    address public flashToken;
    uint256 public flashValue;
    address public flashSender;

    function onFlashLoan(address sender, address token, uint256 value, uint256, bytes calldata data) external returns(bytes32) {
        address lender = msg.sender;
        (Action action) = abi.decode(data, (Action)); // Use this to unpack arbitrary data
        flashSender = sender;
        flashToken = token;
        flashValue = value;
        if (action == Action.NORMAL) {
            flashBalance = Dai(lender).balanceOf(address(this));
        } else if (action == Action.STEAL) {
            // Do nothing
        } else if (action == Action.REENTER) {
            bytes memory newData = abi.encode(Action.NORMAL);
            Dai(lender).approve(lender, Dai(lender).allowance(address(this), lender) + value * 2);
            Dai(lender).flashLoan(address(this), address(lender), value * 2, newData);
        }
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    function flashLoan(address lender, uint256 value) public {
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.NORMAL);
        Dai(lender).approve(lender, value);
        Dai(lender).flashLoan(address(this), address(lender), value, data);
    }

    function flashLoanAndSteal(address lender, uint256 value) public {
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.STEAL);
        Dai(lender).flashLoan(address(this), address(lender), value, data);
    }

    function flashLoanAndReenter(address lender, uint256 value) public {
        // Use this to pack arbitrary data to `onFlashLoan`
        bytes memory data = abi.encode(Action.REENTER);
        Dai(lender).approve(lender, value);
        Dai(lender).flashLoan(address(this), address(lender), value, data);
    }
}
