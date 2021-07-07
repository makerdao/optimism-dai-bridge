// dai.spec

methods {
    wards(address) returns (uint256) envfree
    name() returns (string) envfree
    symbol() returns (string) envfree
    version() returns (string) envfree
    decimals() returns (uint8) envfree
    totalSupply() returns (uint256) envfree
    balanceOf(address) returns (uint256) envfree
    allowance(address, address) returns (uint256) envfree
    nonces(address) returns (uint256) envfree
    deploymentChainId() returns (uint256) envfree
    PERMIT_TYPEHASH() returns (bytes32) envfree
    DOMAIN_SEPARATOR() returns (bytes32) envfree
}

ghost balanceSum() returns uint256 {
    init_state axiom balanceSum() == 0;
}

hook Sstore balanceOf[KEY address a] uint256 balance (uint256 old_balance) STORAGE {
    havoc balanceSum assuming balanceSum@new() == balanceSum@old() + (balance - old_balance);
}

function strengthenFor2Addresses(address a1, address a2) {
    require(balanceSum() >= balanceOf(a1) + balanceOf(a2));
}

// invariants also check the desired property on the constructor
invariant balanceSum_equals_totalSupply() balanceSum() == totalSupply() {
    preserved transfer(address to, uint _) with (env e) {
        strengthenFor2Addresses(e.msg.sender, to);
    }

    preserved transferFrom(address from, address to, uint _) with (env e) {
        strengthenFor2Addresses(from, to);
    }

    preserved mint(address to, uint _) with (env e) {
        require(balanceSum() >= balanceOf(to));
    }

    preserved burn(address from, uint _) with (env e) {
        require(balanceSum() >= balanceOf(from));
    }
}

// Verify that wards behaves correctly on rely
rule rely(address usr) {
    env e;

    uint256 ward = wards(e.msg.sender);

    rely@withrevert(e, usr);

    if (!lastReverted) {
        assert(wards(usr) == 1, "Rely did not set the wards as expected");
    }

    assert(ward == 0 => lastReverted, "Lack of auth did not revert");
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that wards behaves correctly on deny
rule deny(address usr) {
    env e;

    uint256 ward = wards(e.msg.sender);

    deny@withrevert(e, usr);

    if (!lastReverted) {
        assert(wards(usr) == 0, "Deny did not set the wards as expected");
    }

    assert(ward == 0 => lastReverted, "Lack of auth did not revert");
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that balance behaves correctly on transfer
rule transfer(address to, uint256 value) {
    env e;

    uint256 senderBalance = balanceOf(e.msg.sender);
    uint256 toBalance = balanceOf(to);
    bool senderSameAsReceiver = e.msg.sender == to;

    require(toBalance + value <= max_uint); // Avoid evaluating the overflow case

    transfer(e, to, value);

    assert(!senderSameAsReceiver =>
            balanceOf(e.msg.sender) == senderBalance - value &&
            balanceOf(to) == toBalance + value,
            "Transfer did not change balances as expected"
    );

    assert(senderSameAsReceiver =>
            balanceOf(e.msg.sender) == senderBalance &&
            senderBalance == toBalance,
            "Transfer did not keep the balance in edge case as expected"
    );
}

// Verify revert rules on transfer
rule transfer_revert(address to, uint256 value) {
    env e;

    uint256 senderBalance = balanceOf(e.msg.sender);
    uint256 toBalance = balanceOf(to);

    transfer@withrevert(e, to, value);

    bool revert1 = to == 0 || to == currentContract;
    bool revert2 = senderBalance < value;
    bool revert3 = e.msg.value > 0;

    assert(revert1 => lastReverted, "Incorrect address didn't revert");
    assert(revert2 => lastReverted, "Insufficient balance didn't revert");
    assert(revert3 => lastReverted, "Sending ETH did not revert");
    assert(lastReverted => revert1 || revert2 || revert3, "Revert rules are not covering all the cases");
}

// Verify that balance and allowance behave correctly on transferFrom
rule transferFrom(address from, address to, uint256 value) {
    env e;

    uint256 fromBalance = balanceOf(from);
    uint256 toBalance = balanceOf(to);
    uint256 allowed = allowance(from, e.msg.sender);

    require(toBalance + value <= max_uint); // Avoid evaluating the overflow case

    transferFrom@withrevert(e, from, to, value);

    if (!lastReverted) {
        if e.msg.sender != from && allowed != max_uint {
            assert(allowance(from, e.msg.sender) == allowed - value, "Allowance did not decrease in value");
        } else {
            assert(allowance(from, e.msg.sender) == allowed, "Allowance did not remain the same");
        }
        if (from != to) {
            assert(balanceOf(from) == fromBalance - value, "TransferFrom did not decrease the balance as expected");
            assert(balanceOf(to) == toBalance + value, "TransferFrom did not increase the balance as expected");
        } else {
            assert(balanceOf(from) == fromBalance && fromBalance == toBalance, "TransferFrom did not kept the balance as expected");
        }
    }

    assert(to == 0 || to == currentContract => lastReverted, "Incorrect address did not revert");
    assert(fromBalance < value => lastReverted, "Insufficient balance did not revert");
    assert(allowed < value && e.msg.sender != from => lastReverted, "Insufficient allowance did not revert");
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that allowance behaves correctly on approve
rule approve(address spender, uint256 value) {
    env e;

    approve@withrevert(e, spender, value);

    if (!lastReverted) {
        assert(allowance(e.msg.sender, spender) == value, "Approve did not set the allowance as expected");
    }

    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that allowance behaves correctly on increaseAllowance
rule increaseAllowance(address spender, uint256 value) {
    env e;

    uint256 spenderAllowance = allowance(e.msg.sender, spender);

    increaseAllowance@withrevert(e, spender, value);

    if (!lastReverted) {
        assert(allowance(e.msg.sender, spender) == spenderAllowance + value, "increaseAllowance did not increase the allowance as expected");
    }

    assert(spenderAllowance + value > max_uint => lastReverted, "Overflow did not revert");
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that allowance behaves correctly on decreaseAllowance
rule decreaseAllowance(address spender, uint256 value) {
    env e;

    uint256 spenderAllowance = allowance(e.msg.sender, spender);

    decreaseAllowance@withrevert(e, spender, value);

    if (!lastReverted) {
        assert(allowance(e.msg.sender, spender) == spenderAllowance - value, "decreaseAllowance did not decrease the allowance as expected");
    }

    assert(spenderAllowance - value < 0 => lastReverted, "Underflow did not revert");
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that supply and balance behave correctly on mint
rule mint(address to, uint256 value) {
    env e;

    // Save the totalSupply and sender balance before minting
    uint256 supply = totalSupply();
    uint256 toBalance = balanceOf(to);
    uint256 ward = wards(e.msg.sender);

    require(supply >= toBalance);

    mint@withrevert(e, to, value);

    if (!lastReverted) {
        assert(balanceOf(to) == toBalance + value, "Mint did not increase the balance as expected");
        assert(totalSupply() == supply + value, "Mint did not increase the supply as expected");
    }

    assert(ward == 0 => lastReverted, "Lack of auth did not revert");
    assert(supply + value > max_uint => lastReverted, "Supply overflow did not revert");
    assert(toBalance + value > max_uint => lastReverted, "Balance overflow did not revert");
    assert(to == 0 || to == currentContract => lastReverted, "Incorrect address did not revert");
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that supply and balance behave correctly on burn
rule burn(address from, uint256 value) {
    env e;

    uint256 supply = totalSupply();
    uint256 fromBalance = balanceOf(from);
    uint256 allowed = allowance(from, e.msg.sender);
    uint256 ward = wards(e.msg.sender);

    require(supply >= fromBalance);

    burn@withrevert(e, from, value);

    if (!lastReverted) {
        if from != e.msg.sender && wards(e.msg.sender) != 1 && allowed != max_uint {
            assert(allowance(from, e.msg.sender) == allowed - value);
        } else {
            assert(allowance(from, e.msg.sender) == allowed);
        }
        assert(balanceOf(from) == fromBalance - value, "Burn did not decrease the balance as expected");
        assert(totalSupply() == supply - value, "Burn did not decrease the supply as expected");
    }

    assert(fromBalance < value => lastReverted, "Balance underflow did not revert");
    assert(from != e.msg.sender && ward != 1 && allowed < value => lastReverted, "Allowance underflow did not revert");
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}

// Verify that allowance behaves correctly on permit
rule permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) {
    env e;

    permit@withrevert(e, owner, spender, value, deadline, v, r, s);

    if (!lastReverted) {
        assert(allowance(owner, spender) == value, "Permit did not set the allowance as expected");
    }

    assert(e.block.timestamp > deadline => lastReverted, "Deadline exceed did not revert");
    // TODO: Add the missing revert condition
    assert(e.msg.value > 0 => lastReverted, "Sending ETH did not revert");
}
