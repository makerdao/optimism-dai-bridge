// dai-invariant.spec

methods {
    balanceOf(address) returns (uint256) envfree
    totalSupply() returns (uint256) envfree
    rely(address)
    deny(address)
    transfer(address, uint256)
    transferFrom(address, address, uint256)
    approve(address, uint256)
    increaseAllowance(address, uint256)
    decreaseAllowance(address, uint256)
    mint(address, uint256)
    burn(address, uint256)
    permit(address, address, uint256, uint256, uint8, bytes32, bytes32)
}

ghost balanceSum() returns uint256 {
    init_state axiom balanceSum() == 0;
}

hook Sstore balanceOf[KEY address a] uint256 balance (uint256 old_balance) STORAGE {
    havoc balanceSum assuming balanceSum@new() == balanceSum@old() + (balance - old_balance);
}

// invariants also check the desired property on the constructor
invariant balanceSum_equals_total() balanceSum() == totalSupply()
