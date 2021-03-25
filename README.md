# Optimism Dai Bridge

Optimism Dai and upgradable token bridge

## Contracts

- `l2/dai.sol` - Improved DAI contract
- `l1/L1ERC20Gateway.sol` - L1 side of the bridge. Escrows L1 DAI in a specified address. Unlocks L1 DAI upon withdrawal
  message from `L2DepositedToken`
- `l2/L2DepositedToken.sol` - L2 side of the bridge. Mints new L2 DAI after receiving message from `L1ERC20Gateway`.
  Burns L2 DAI tokens when withdrawals happens

## Upgrade guide

### Deploying new token bridge

This bridge stores funds in an external escrow account rather than on the bridge address itself. To upgrade, deploy new
bridge independently and connect to the same escrow. Thanks to this, no bridge will ever run out of funds.

### Closing bridge

After deploying a new bridge you might consider closing the old one. Procedure is slightly complicated due to async
messages like `finalizeDeposit` and `finalizeWithdraw` that can be in progress.

An owner calls `L2DepositedToken.close()` and `L1ERC20Gateway.close()` so no new async messages can be sent to the other
part of the bridge. After all async messages are done processing (can take up to 1 week) bridge is effectively closed.
Now, you can consider revoking approval to access funds from escrow on L1 and token minting rights on L2.

## Running

```
yarn
yarn build
yarn test  # runs unit tests
```

## Running E2E tests

```
# start optimism-integration
git clone https://github.com/ethereum-optimism/optimism-integration.git
cd optimism-integration
./up.sh

# in other terminal window run this project
yarn build
yarn test-e2e  # runs unit tests
```

## Development

Run `yarn test:fix` to run linting in fix mode, auto-formatting and unit tests.

Running `yarn test` makes sure that contracts are compiled. Running `yarn test-e2e` doesn't.
