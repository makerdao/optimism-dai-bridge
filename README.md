# Optimism Bridge Playground

Upgradable token bridge and Optimism Dai

## Contracts

- `l2/dai.sol` - Improved DAI contract
- `l1/L1ERC20Gateway.sol` - L1 side of the bridge. Escrows L1 DAI in a specified address. Unlocks L1 DAI upon withdrawal
  message from `L2DepositedToken`
- `l2/L2DepositedToken.sol` - L2 side of the bridge. Mints new L2 DAI after receiving message from `L1ERC20Gateway`.
  Burns L2 DAI tokens when withdrawals happens

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
