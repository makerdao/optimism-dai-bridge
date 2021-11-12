pragma solidity >=0.7.6;

struct WormholeGUID {
  bytes32 sourceDomain;
  bytes32 targetDomain;
  address receiver;
  address operator;
  uint128 amount;
  uint64 nonce;
  uint64 timestamp;
}
