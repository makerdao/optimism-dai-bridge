pragma solidity >=0.7.6;
pragma abicoder v2;

struct WormholeGUID {
  bytes32 sourceDomain;
  bytes32 targetDomain;
  address receiver;
  address operator;
  uint128 amount;
  uint64 nonce;
  uint64 timestamp;
}

library WormholeLib {
  function getHash(WormholeGUID memory wormhole) public pure returns (bytes32) {
    return
      keccak256(
        abi.encode(
          wormhole.sourceDomain,
          wormhole.targetDomain,
          wormhole.receiver,
          wormhole.operator,
          wormhole.amount,
          wormhole.nonce,
          wormhole.timestamp
        )
      );
  }
}
