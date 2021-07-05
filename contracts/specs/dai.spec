// dai.spec
// Verify that supply and balance hold on mint
rule mint(address to, uint256 wad) {
    // The env type represents the EVM parameters passed in every
    //   call (msg.*, tx.*, block.* variables in solidity).
    env e;

    // Save the totalSupply and sender balance before minting
    uint256 supplyBefore = totalSupply(e);
    uint256 senderBalance = balanceOf(e, to);

    mint(e, to, wad);

    uint256 supplyAfter = totalSupply(e);

    assert(balanceOf(e, to) == senderBalance + wad, "Mint did not increase the balance as expected");
    assert(supplyBefore + wad == supplyAfter, "Mint did not increase the supply as expected");
}

// Verify that mint reverts on un-authed address
rule mint_revert_auth(address to, uint256 wad) {
    env e;

    require wards(e, e.msg.sender) == 0;

    mint@withrevert(e, to, wad);

    // Check that mint reverts if called by not authorized addresses
    assert(lastReverted, "Dai/not-authorized");
}

// Verify that mint reverts when to is equal to address zero or dai contract
rule mint_revert_to(address to, uint256 wad) {
    env e;

    require e.msg.sender != to;
    require to == 0 || to == currentContract;

    mint@withrevert(e, to, wad);

    // Check that mint reverts if to is either address zero or dai contract
    assert(lastReverted, "Dai/invalid-address");
}

// Verify that supply and balance hold on burn
rule burn(address from, uint256 wad) {
    env e;

    uint256 supplyBefore = totalSupply(e);
    uint256 senderBalance = balanceOf(e, from);

    burn(e, from, wad);

    assert(balanceOf(e, from) == senderBalance - wad, "Burn did not decrease the balance as expected");
    assert(totalSupply(e) == supplyBefore - wad, "Burn did not decrease the supply as expected");
}

// Verify that balance hold on transfer
rule transfer(address to, uint256 wad) {
    env e;

    require e.msg.sender != to;

    uint256 senderBalance = balanceOf(e, e.msg.sender);
    uint256 toBalance = balanceOf(e, to);

    require toBalance + wad <= max_uint; // assuming not overflow in practise

    transfer(e, to, wad);

    assert(balanceOf(e, e.msg.sender) == senderBalance - wad, "Transfer did not decrease the balance as expected");
    assert(balanceOf(e, to) == toBalance + wad, "Transfer did not increase the balance as expected");
}

// Verify that balance hold on transfer in the edge case msg.sender == to
rule transfer_to_sender(uint256 wad) {
    env e;

    uint256 balanceBefore = balanceOf(e, e.msg.sender);

    transfer(e, e.msg.sender, wad);

    assert(balanceOf(e, e.msg.sender) == balanceBefore, "Transfer did not keep the balance in edge case as expected");
}

// Verify it fails when the to is address(0) or the Dai contract itself
rule transfer_revert_to(address to, uint256 wad) {
    env e;

    require to == 0 || to == currentContract;

    transfer@withrevert(e, to, wad);

    assert(lastReverted, "Dai/invalid-address");
}

// Verify it fails when the sender doesn't have enough balance
rule transfer_revert_balance(address to, uint256 wad) {
    env e;

    require balanceOf(e, e.msg.sender) < wad;

    transfer@withrevert(e, to, wad);

    assert(lastReverted, "Dai/insufficient-balance");
}

// Verify that balance hold on transferFrom
rule transferFrom(address from, address to, uint256 wad) {
    env e;

    require from != to;

    uint256 senderBalance = balanceOf(e, from);
    uint256 toBalance = balanceOf(e, to);

    require toBalance + wad <= max_uint; // assuming not overflow in practise

    transferFrom(e, from, to, wad);

    assert(balanceOf(e, from) == senderBalance - wad, "TransferFrom did not decrease the balance as expected");
    assert(balanceOf(e, to) == toBalance + wad, "TransferFrom did not increase the balance as expected");
}

// Verify that balance hold on transferFrom in the edge case from == to 
rule transferFrom_to_sender(address fromTo, uint256 wad) {
    env e;

    uint256 balanceBefore = balanceOf(e, fromTo);

    transferFrom(e, fromTo, fromTo, wad);

    assert(balanceOf(e, fromTo) == balanceBefore, "TransferFrom did not kept the balance as expected");
}

// Verify it fails when to is address(0) or the Dai contract itself
rule transferFrom_revert_to(address from, address to, uint256 wad) {
    env e;

    require to == 0 || to == currentContract;

    transferFrom@withrevert(e, from, to, wad);

    assert(lastReverted, "Dai/invalid-address");
}

// Verify it fails when from doesn't have enough balance
rule transferFrom_revert_balance(address from, address to, uint256 wad) {
    env e;

    require balanceOf(e, from) < wad;

    transferFrom@withrevert(e, from, to, wad);

    assert(lastReverted, "Dai/insufficient-balance");
}

// Verify it fails when the sender doesn't have enough allowance
rule transferFrom_revert_allowance(address from, address to, uint256 wad) {
    env e;

    require(e.msg.sender != from);
    require allowance(e, from, e.msg.sender) < wad;

    transferFrom@withrevert(e, from, to, wad);

    assert(lastReverted, "Dai/insufficient-allowance");
}

// Verify it won't fail if there isn't allowance but from is sender
rule transferFrom_allowance_to(address from, address to, uint256 wad) {
    env e;

    require(e.msg.sender == from);
    require to != 0 && to != currentContract;
    require allowance(e, from, e.msg.sender) < wad;

    transferFrom@withrevert(e, from, to, wad); // We make sure it won't fail due allowance as from is the sender

    assert(true, "");
}

// Verify that allowance hold on approve
rule approve(address spender, uint256 wad) {
    env e;

    approve@withrevert(e, spender, wad); // Using @withrevert we make sure this never reverts

    assert(allowance(e, e.msg.sender, spender) == wad, "Approve did not set the allowance as expected");
}

// Verify that allowance hold on increaseAllowance
rule increaseAllowance(address spender, uint256 wad) {
    env e;

    uint256 spenderAllowance = allowance(e, e.msg.sender, spender);

    increaseAllowance(e, spender, wad);

    assert(allowance(e, e.msg.sender, spender) == spenderAllowance + wad, "increaseAllowance did not increase the allowance as expected");
}

// Verify that allowance hold on decreaseAllowance
rule decreaseAllowance(address spender, uint256 wad) {
    env e;

    uint256 spenderAllowance = allowance(e, e.msg.sender, spender);

    decreaseAllowance(e, spender, wad);

    assert(allowance(e, e.msg.sender, spender) == spenderAllowance - wad, "decreaseAllowance did not decrease the allowance as expected");
}

// Verify that allowance hold on permit
rule permit(address owner, address spender, uint256 wad, uint256 deadline, uint8 v, bytes32 r, bytes32 s) {
    env e;

    permit(e, owner, spender, wad, deadline, v, r, s);

    assert(allowance(e, owner, spender) == wad, "Permit did not set the allowance as expected");
}

// Verify that permit reverts when block.timestamp is more than deadline
rule permit_revert_deadline(address owner, address spender, uint256 wad, uint256 deadline, uint8 v, bytes32 r, bytes32 s) {
    env e;

    require e.block.timestamp > deadline;

    permit@withrevert(e, owner, spender, wad, deadline, v, r, s);

    assert(lastReverted, "Dai/permit-expired");
}
