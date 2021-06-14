// SPDX-License-Identifier: AGPL-3.0-or-later

// Copyright (C) 2017, 2018, 2019 dbrock, rain, mrchico
// Copyright (C) 2021 Dai Foundation

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

import "./dai.sol";
import { IERC165 } from "@openzeppelin/contracts/introspection/IERC165.sol";

interface IL2StandardTokenLike {
    function l1Token() external returns (address);

    function mint(address _to, uint256 _amount) external;

    function burn(address _from, uint256 _amount) external;
}

// Add neccesary interfaces to work with Optimism's StandardTokenBridge

contract OptimismDai is Dai, IERC165 {
    address immutable public l1Token;

    constructor(address _l1Token) {
        l1Token = _l1Token;
    }

    function supportsInterface(bytes4 _interfaceId) public override pure returns (bool) {
        bytes4 firstSupportedInterface = bytes4(keccak256("supportsInterface(bytes4)")); // ERC165
        bytes4 secondSupportedInterface = IL2StandardTokenLike.l1Token.selector
            ^ IL2StandardTokenLike.mint.selector
            ^ IL2StandardTokenLike.burn.selector;
        return _interfaceId == firstSupportedInterface || _interfaceId == secondSupportedInterface;
    }
}