// dai.spec
// Verify that supply and balance hold on mint
rule mint(address to, uint256 value) {
    // The env type represents the EVM parameters passed in every
    //   call (msg.*, tx.*, block.* variables in solidity).
    env e;

    // Save the totalSupply and sender balance before minting
    uint256 supplyBefore = totalSupply(e);
    uint256 senderBalance = balanceOf(e, to);

    mint(e, to, value);

    uint256 supplyAfter = totalSupply(e);

    assert(balanceOf(e, to) == senderBalance + value, "Mint did not increase the balance as expected");
    assert(supplyBefore + value == supplyAfter, "Mint did not increase the supply as expected");
}

// Verify that mint reverts on un-authed address
rule mint_revert_auth(address to, uint256 value) {
    env e;

    require wards(e, e.msg.sender) == 0;

    mint@withrevert(e, to, value);

    // Check that mint reverts if called by not authorized addresses
    assert(lastReverted, "It didn't revert");
}

// Verify that mint reverts on supply overflow
rule mint_revert_overflow_supply(address to, uint256 value) {
    env e;

    require totalSupply(e) + value > max_uint;

    mint@withrevert(e, to, value);

    // Check that mint reverts if overflows
    assert(lastReverted, "It didn't revert");
}

// Verify that mint reverts on supply balance
rule mint_revert_overflow_balance(address to, uint256 value) {
    env e;

    require balanceOf(e, to) + value > max_uint;

    mint@withrevert(e, to, value);

    // Check that mint reverts if overflows
    assert(lastReverted, "It didn't revert");
}

// Verify that mint reverts when to is equal to address zero or dai contract
rule mint_revert_to(address to, uint256 value) {
    env e;

    require e.msg.sender != to;
    require to == 0 || to == currentContract;

    mint@withrevert(e, to, value);

    // Check that mint reverts if to is either address zero or dai contract
    assert(lastReverted, "It didn't revert");
}

// Verify that supply and balance hold on burn
rule burn(address from, uint256 value) {
    env e;

    uint256 supplyBefore = totalSupply(e);
    uint256 senderBalance = balanceOf(e, from);
    uint256 allowed = allowance(e, from, e.msg.sender);

    burn(e, from, value);

    if from != e.msg.sender && wards(e, e.msg.sender) != 1 && allowed != max_uint
        assert(allowance(e, from, e.msg.sender) == allowed - value);
    assert(balanceOf(e, from) == senderBalance - value, "Burn did not decrease the balance as expected");
    assert(totalSupply(e) == supplyBefore - value, "Burn did not decrease the supply as expected");
}

// Verify that burn reverts when insufficient balance
rule burn_revert_balance(address from, uint256 value) {
    env e;

    require balanceOf(e, from) < value;

    burn@withrevert(e, from, value);

    assert(lastReverted, "It didn't revert");
}

// Verify that burn reverts when insufficient allowance
rule burn_revert_allowance(address from, uint256 value) {
    env e;

    require from != e.msg.sender && wards(e, e.msg.sender) != 1;
    require allowance(e, from, e.msg.sender) < value;

    burn@withrevert(e, from, value);

    assert(lastReverted, "It didn't revert");
}

// Verify that balance behave correctly on transfer
rule transfer(address to, uint256 value) {
    env e;

    uint256 senderBalance = balanceOf(e, e.msg.sender);
    uint256 toBalance = balanceOf(e, to);

    require toBalance + value <= max_uint; // Avoid evaluating the overflow case

    transfer@withrevert(e, to, value);

    if (!lastReverted) {
        if (e.msg.sender != to) {
            assert(balanceOf(e, e.msg.sender) == senderBalance - value, "Transfer did not decrease the balance as expected");
            assert(balanceOf(e, to) == toBalance + value, "Transfer did not increase the balance as expected");
        } else {
            assert(balanceOf(e, e.msg.sender) == senderBalance && senderBalance == toBalance, "Transfer did not keep the balance in edge case as expected");
        }
    }

    assert(to == 0 || to == currentContract => lastReverted , "Incorrect address didn't revert");
    assert(senderBalance < value => lastReverted , "Insufficient balance didn't revert");
}

// Verify that balance and allowance behave correctly on transferFrom
rule transferFrom(address from, address to, uint256 value) {
    env e;

    uint256 senderBalance = balanceOf(e, from);
    uint256 toBalance = balanceOf(e, to);
    uint256 allowed = allowance(e, from, e.msg.sender);

    require toBalance + value <= max_uint; // Avoid evaluating the overflow case

    transferFrom@withrevert(e, from, to, value);

    if (!lastReverted) {
        if e.msg.sender != from && allowed != max_uint {
            assert(allowance(e, from, e.msg.sender) == allowed - value, "Allowance did not decrease in value");
        } else {
            assert(allowance(e, from, e.msg.sender) == allowed, "Allowance did not remain the same");
        }
        if (from != to) {
            assert(balanceOf(e, from) == senderBalance - value, "TransferFrom did not decrease the balance as expected");
            assert(balanceOf(e, to) == toBalance + value, "TransferFrom did not increase the balance as expected");
        } else {
            assert(balanceOf(e, from) == senderBalance && senderBalance == toBalance, "TransferFrom did not kept the balance as expected");
        }
    }

    assert(to == 0 || to == currentContract => lastReverted , "Incorrect address did not revert");
    assert(senderBalance < value => lastReverted , "Insufficient balance did not revert");
    assert(allowed < value && e.msg.sender != from => lastReverted, "Insufficient allowance did not revert");
}

// Verify that allowance hold on approve
rule approve(address spender, uint256 value) {
    env e;

    approve@withrevert(e, spender, value); // This function never reverts

    assert(allowance(e, e.msg.sender, spender) == value, "Approve did not set the allowance as expected");
}

// Verify that allowance hold on increaseAllowance
rule increaseAllowance(address spender, uint256 value) {
    env e;

    uint256 spenderAllowance = allowance(e, e.msg.sender, spender);

    increaseAllowance@withrevert(e, spender, value);

    if (!lastReverted) {
        assert(allowance(e, e.msg.sender, spender) == spenderAllowance + value, "increaseAllowance did not increase the allowance as expected");
    }

    assert(spenderAllowance + value > max_uint => lastReverted, "Overflow did not revert");
}

// Verify that allowance hold on decreaseAllowance
rule decreaseAllowance(address spender, uint256 value) {
    env e;

    uint256 spenderAllowance = allowance(e, e.msg.sender, spender);

    decreaseAllowance@withrevert(e, spender, value);

    if (!lastReverted) {
        assert(allowance(e, e.msg.sender, spender) == spenderAllowance - value, "decreaseAllowance did not decrease the allowance as expected");
    }

    assert(spenderAllowance - value < 0 => lastReverted, "Underflow did not revert");
}

// Verify that allowance hold on permit
rule permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) {
    env e;

    permit(e, owner, spender, value, deadline, v, r, s);

    assert(allowance(e, owner, spender) == value, "Permit did not set the allowance as expected");
}

// Verify that permit reverts when block.timestamp is more than deadline
rule permit_revert_deadline(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) {
    env e;

    require e.block.timestamp > deadline;

    permit@withrevert(e, owner, spender, value, deadline, v, r, s);

    assert(lastReverted, "It didn't revert");
}

// Verify that wards hold on rely
rule rely(address usr) {
    env e;

    rely(e, usr);

    assert(wards(e, usr) == 1, "Rely did not set the wards as expected");
}

// Verify that rely reverts on not authorized addresses
rule rely_revert_auth(address usr) {
    env e;

    require wards(e, e.msg.sender) == 0;

    rely@withrevert(e, usr);

    assert(lastReverted, "It didn't revert");
}

// Verify that wards hold on deny
rule deny(address usr) {
    env e;

    deny(e, usr);

    assert(wards(e, usr) == 0, "Deny did not set the wards as expected");
}

// Verify that deny reverts on not authorized addresses
rule deny_revert_auth(address usr) {
    env e;

    require wards(e, e.msg.sender) == 0;

    deny@withrevert(e, usr);

    assert(lastReverted, "It didn't revert");
}
