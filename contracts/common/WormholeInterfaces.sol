// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2021 Dai Foundation
//
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

pragma solidity >=0.7.6;
pragma abicoder v2;
import {WormholeGUID} from "./WormholeGUID.sol";

interface L1WormholeRouter {
  function requestMint(
    WormholeGUID calldata wormholeGUID,
    uint256 maxFeePercentage,
    uint256 operatorFee
  ) external returns (uint256 postFeeAmount, uint256 totalFee);

  function settle(bytes32 targetDomain, uint256 batchedDaiToFlush) external;
}

interface IL1WormholeBridge {
  function l1Token() external view returns (address);

  function l1Escrow() external view returns (address);

  function l1WormholeRouter() external view returns (L1WormholeRouter);

  function l2WormholeBridge() external view returns (address);

  function finalizeFlush(bytes32 targetDomain, uint256 daiToFlush) external;

  function finalizeRegisterWormhole(WormholeGUID calldata wormhole) external;
}

// interface L2WormholeBridge {
//     function l2Token() external returns(address);
//     function l1WormholeBridge() external returns(address);
//     function domain() external returns(bytes32);

// }
