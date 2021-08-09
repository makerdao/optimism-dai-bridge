pragma solidity 0.7.6;

// HashHelper for permit spec

contract HashHelper {    
    function computeDigestForDai(
        bytes32 domain_separator,
        bytes32 permit_typehash,
        address owner,
        address spender,
        uint256 value,
        uint256 nonce,
        uint256 deadline
    ) public pure returns (bytes32 digest){
        digest =
        keccak256(abi.encodePacked(
            "\x19\x01",
            domain_separator,
            keccak256(abi.encode(
                permit_typehash,
                owner,
                spender,
                value,
                nonce,
                deadline
            ))
        ));
    }

    function call_ecrecover(
        bytes32 digest,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (address signer) {
        signer = ecrecover(digest, v, r, s);
    }
}