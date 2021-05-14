[![Lint](https://github.com/BellwoodStudios/optimism-dai-bridge/actions/workflows/lint.yml/badge.svg)](https://github.com/BellwoodStudios/optimism-dai-bridge/actions/workflows/lint.yml)
[![Tests](https://github.com/BellwoodStudios/optimism-dai-bridge/actions/workflows/tests.yml/badge.svg)](https://github.com/BellwoodStudios/optimism-dai-bridge/actions/workflows/tests.yml)
[![Fuzz](https://github.com/BellwoodStudios/optimism-dai-bridge/actions/workflows/fuzz.yml/badge.svg)](https://github.com/BellwoodStudios/optimism-dai-bridge/actions/workflows/fuzz.yml)

# Optimism Dai Bridge

Optimism Dai and upgradable token bridge

## Contracts

- `l2/dai.sol` - Improved DAI contract
- `l1/L1Gateway.sol` - L1 side of the bridge. Escrows L1 DAI in a specified address. Unlocks L1 DAI upon withdrawal
  message from `L2Gateway`
- `l2/L2Gateway.sol` - L2 side of the bridge. Mints new L2 DAI after receiving message from `L1Gateway`. Burns L2 DAI
  tokens when withdrawals happen.

## Scripts

Some of these scripts may require valid `.env` file. Copy `.env.example` as `.env` and fill it out.

- `scripts/deployMainnet.ts` - deploys a full solution to forked mainnet and optimism testnet on kovan. Run with
  `yarn deploy:mainnet-fork`
- `scripts/deployKovan.ts` - deploys a full solution to kovan and optimism testnet on kovan. Run with
  `yarn deploy:kovan`

## Upgrade guide

### Deploying new token bridge

This bridge stores funds in an external escrow account rather than on the bridge address itself. To upgrade, deploy new
bridge independently and connect to the same escrow. Thanks to this, no bridge will ever run out of funds.

### Closing bridge

After deploying a new bridge you might consider closing the old one. Procedure is slightly complicated due to async
messages like `finalizeDeposit` and `finalizeWithdraw` that can be in progress.

An owner calls `L2Gateway.close()` and `L1Gateway.close()` so no new async messages can be sent to the other part of the
bridge. After all async messages are done processing (can take up to 1 week) bridge is effectively closed. Now, you can
consider revoking approval to access funds from escrow on L1 and token minting rights on L2.

## Known Risks

### Optimism's bug

Optimism is a new, not yet battle-tested system. If there is a bug that allows the attacker to proof an arbitrary
messages from L2 it would be possible to drain escrowed funds. This can be caused by the bug inside
`OVM_L1CrossDomainMessenger` contract or a bug preventing fraud proofs to be submitted.

If malicious messages are not subject to a dispute window (1 week) all funds from escrow could be withdrawn by the
attacker. This would cause L2 DAI being worthless.

In case when such messages are still subject to a dispute window, it would be possible for governance to reject approval
from `L1Gateway` to `L1Escrow` by calling `L1Escrow.approve(DAI, L1Gateway, 0)` and stop drainage.

If such disastrous scenario occurs but governance succeeds to safe escrowed funds, rollup state can be reconstructed
from the last valid state commitment and user funds and be retrieved in a separate process.

## Invariants

### L1 DAI Locked and L2 DAI Minted

```
L1DAI.balanceOf(escrow) ≥ L2DAI.totalSupply()
```

All DAI available on L2 should be locked on L1. This should hold true with more bridges as well.

It's `>=` because:

a) when depositing on L1, locking is instant but minting is an async message

b) when withdrawing from L2, burning is instant but unlocking on L1 is an async message and is subject to a dispute
period (1 week)

c) someone can send L1DAI directly to escrow

## Running

```
yarn
yarn build
yarn test  # runs unit tests
```

## Running E2E tests

```
# clone optimism monorepo and run dockerized infrastructure
git clone https://github.com/ethereum-optimism/optimism.git
cd optimism
git checkout ae1ac05d7032422a71caf25d16f6e548df5b8d7f
cd ops
export COMPOSE_DOCKER_CLI_BUILD=1
export DOCKER_BUILDKIT=1
docker-compose build
docker-compose up

# in other terminal window run this project
yarn build
yarn test-e2e  # runs unit tests
```

## Development

Run `yarn test:fix` to run linting in fix mode, auto-formatting and unit tests.

Running `yarn test` makes sure that contracts are compiled. Running `yarn test-e2e` doesn't.

## Fuzzing

### Install Echidna

- Precompiled Binaries (recommended)

Before starting, make sure Slither is installed: `$ pip3 install slither-analyzer`

To quickly test Echidna in Linux or MacOS: [release page](https://github.com/crytic/echidna/releases)

### Local Dependencies

- Slither `$ pip3 install slither-analyzer`

- solc-select `$ pip3 install solc-select`

### Run Echidna Tests

- Install solc version: `$ solc-select install 0.7.6`

- Select solc version: `$ solc-select use 0.7.6`

- Run Echidna Tests:
  `$ echidna-test contracts/test/DaiEchidnaTest.sol --contract DaiEchidnaTest --config echidna.config.yml`

## Deployments:

### Kovan:

```
L1 DAI: 0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa # part of MCD deployment on kovan: https://changelog.makerdao.com/
L1 Gateway:  0x6ee092cDe7B9660015C020ED4666EE90291aBd5d
L1 Escrow:  0x9b0506371eee93Bb14427692E42c692827dc4468
L1 Governance Relay:  0xEBb305baff5D3272e74683699E23D117E0fce143
L2 DAI:  0xaB90DD8836a2Ac1eEF90B639c6895778ca56B0cA
L2 Gateway:  0xEEC0359d2e689391FCa953364b53887d66057533
L2 Governance Relay:  0x65943918c69D1aE0eF05f14f08f691B072Bc06eb
```
