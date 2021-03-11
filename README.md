# Optimism Bridge Playground

## Running

```
# in other terminal window run this project
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
yarn
yarn build
yarn test-e2e  # runs unit tests
```

## Development

Run `yarn test:fix` to run linting in fix mode, auto-formatting and unit tests.

Running `yarn test` makes sure that contracts are compiled. Running `yarn test-e2e` doesn't.
