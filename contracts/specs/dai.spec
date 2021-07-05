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
rule mint_auth_reverts(uint256 wad) {
    env e;

    require wards(e, e.msg.sender) == 0;

    mint@withrevert(e, e.msg.sender, wad);

    // Check that mint reverts if called by not authorized addresses
    assert(lastReverted, "Dai/not-authorized");
}

// Verify that mint reverts when to is equal to address zero or dai contract
rule mint_to_reverts(uint256 wad) {
    env e;

    address to;

    require e.msg.sender != to;
    require to == 0 || to == currentContract;

    mint@withrevert(e, to, wad);

    // Check that mint reverts if to is either address zero or dai contract
    assert(lastReverted, "Dai/invalid-address");
}

// Verify that supply and balance hold on burn
rule burn(address to, uint256 wad) {
    env e;

    require balanceOf(e, to) > 0;

    uint256 supplyBefore = totalSupply(e);
    uint256 senderBalance = balanceOf(e, to);

    burn(e, to, wad);

    assert(balanceOf(e, to) == senderBalance - wad, "Burn did not decrease the balance as expected");
    assert(totalSupply(e) == supplyBefore - wad, "Burn did not decrease the supply as expected");
}

// Verify that balance hold on transfer
rule transfer(address to, uint256 wad) {
    env e;

    require e.msg.sender != to;
    require balanceOf(e, e.msg.sender) >= wad;

    uint256 senderBalance = balanceOf(e, e.msg.sender);
    uint256 toBalance = balanceOf(e, to);

    require toBalance + wad <= max_uint; // assuming not overflow in practise

    transfer(e, to, wad);

    assert(balanceOf(e, e.msg.sender) == senderBalance - wad, "Transfer did not decrease the balance as expected");
    assert(balanceOf(e, to) == toBalance + wad, "Transfer did not increase the balance as expected");
}

// Verify that balance hold on transfer in the edge case msg.sender == alice
rule transfer_edge_case(uint256 wad) {
    env e;

    address alice;

    require e.msg.sender == alice;
    require balanceOf(e, e.msg.sender) >= wad;

    uint256 senderBalance = balanceOf(e, e.msg.sender);
    uint256 aliceBalance = balanceOf(e, alice);

    assert(senderBalance == aliceBalance);

    transfer(e, alice, wad);

    assert(balanceOf(e, alice) == balanceOf(e, e.msg.sender), "Transfer did not keep the balance in edge case as expected");
}

// Verify that balance hold on transferFrom
rule transferFrom(address from, address to, uint256 wad) {
    env e;

    require from != to;
    require balanceOf(e, from) >= wad;

    uint256 senderBalance = balanceOf(e, from);
    uint256 toBalance = balanceOf(e, to);

    require toBalance + wad <= max_uint; // assuming not overflow in practise

    transferFrom(e, from, to, wad);

    assert(balanceOf(e, from) == senderBalance - wad, "TransferFrom did not decrease the balance as expected");
    assert(balanceOf(e, to) == toBalance + wad, "TransferFrom did not increase the balance as expected");
}
