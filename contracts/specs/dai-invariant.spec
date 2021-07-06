// dai-invariant.spec

methods {
    balanceOf(address) returns (uint256) envfree
    totalSupply() returns (uint256) envfree
}

ghost balanceSum() returns uint256 {
    init_state axiom balanceSum() == 0;
}

hook Sstore balanceOf[KEY address a] uint256 balance (uint256 old_balance) STORAGE {
    havoc balanceSum assuming balanceSum@new() == balanceSum@old() + (balance - old_balance);
}

function strengthenFor2Addresses(address a1, address a2) {
    require balanceSum() >= balanceOf(a1) + balanceOf(a2);
}

// invariants also check the desired property on the constructor
invariant balanceSum_equals_totalSupply() balanceSum() == totalSupply() {
    preserved transfer(address to, uint _) with (env e) {
        strengthenFor2Addresses(to, e.msg.sender);
    }

    preserved transferFrom(address from, address to, uint _) with (env e) {
        strengthenFor2Addresses(to, from);
    }
}
