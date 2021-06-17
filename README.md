[![Lint](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/lint.yml/badge.svg)](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/lint.yml)
[![Check](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/check.yml/badge.svg)](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/check.yml)
[![Tests](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/tests.yml/badge.svg)](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/tests.yml)
[![Fuzz](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/fuzz.yml/badge.svg)](https://github.com/makerdao/optimism-dai-bridge/actions/workflows/fuzz.yml)

# Optimism Dai Bridge

Optimism Dai and upgradable token bridge

## Contracts

- `dai.sol` - Improved DAI contract.
- `L1DAITokenBridge.sol` - L1 side of the bridge. Escrows L1 DAI in `L1Escrow` contract. Unlocks L1 DAI upon withdrawal
  message from `L2DAITokenBridge`.
- `L2DAITokenBridge.sol` - L2 side of the bridge. Mints new L2 DAI after receiving a message from `L1DAITokenBridge`.
  Burns L2 DAI tokens when withdrawals happen.
- `L1Escrow` - Hold funds on L1. Allows having many bridges coexist on L1 and share liquidity.
- `L1GovernanceRelay` & `L2GovernanceRelay` - allows to execute a governance spell on L2.

## Upgrade guide

### Deploying new token bridge

This bridge stores funds in an external escrow account rather than on the bridge address itself. To upgrade, deploy new
bridge independently and connect to the same escrow. Thanks to this, no bridge will ever run out of funds.

### Closing bridge

After deploying a new bridge you might consider closing the old one. The procedure is slightly complicated due to async
messages like `finalizeDeposit` and `finalizeWithdraw` that can be in progress.

An owner calls `L2DAITokenBridge.close()` and `L1DAITokenBridge.close()` so no new async messages can be sent to the
other part of the bridge. After all async messages are done processing (can take up to 1 week) bridge is effectively
closed. Now, you can consider revoking approval to access funds from escrow on L1 and token minting rights on L2.

## Emergency shutdown

If ES is triggered, ESM contract can be used to `deny` access from the `PauseProxy` (governance). In such scenario the
bridge continues to work as usual and it's impossible to be closed.

## Known Risks

### Optimism's bug

In this section, we describe various risks caused by possible **bugs** in Optimism system.

**L1 -> L2 message passing bug**

Bug allowing to send arbitrary messages from L1 to L2 ie. making `OVM_L2CrossDomainMessenger` to send arbitrary
messages, could result in minting of uncollateralized L2 DAI. This can be done via:

- sending `finalizeDeposit` messages directly to `L2DAITokenBridge`
- granting minting rights by executing malicious spell with `L2GovernanceRelay`

Immediately withdrawing L2 DAI to L1 DAI is not possible because of the dispute period (1 week). In case of such bug,
governance can disconnect `L1DAITokenBridge` from `L1Escrow`, ensuring that no L1 DAI can be stolen. Even with 2 days
delay on governance actions, there should be plenty of time to coordinate action. Later off-chain coordination is
required to send DAI back to rightful owners or redeploy Optimism system.

**L2 -> L1 message passing bug**

Bug allowing to send arbitrary messages from L2 to L1 is potentially more harmful. This can happen two ways:

1. Bug in `OVM_L1CrossDomainMessenger` allows sending arbitrary messages on L1 bypassing the dispute period,
2. The fraud proof system stops working which allows submitting incorrect state root. Such state root can be used to
   proof an arbitrary message sent from L2 to L1. This will be a subject to a dispute period (1 week).

If (1) happens, an attacker can immediately drain L1 DAI from `L1Escrow`.

If (2) happens, governance can disconnect `L1DAITokenBridge` from `L1Escrow` and prevent from stealing L1 DAI.

### Governance mistake during upgrade

Bridge upgrade is not a trivial procedure due to the async messages between L1 and L2. Whole process is described in
_Upgrade guide_ in this document.

If governance spell mistakenly revokes old bridge approval to access escrow funds async withdrawal messages will fail.
Fortunately reverted messages can be replied at later date, so governance has to re-approve old `L1DAITokenBridge` to
escrow funds and process again pending withdrawals.

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

## Scripts

Some of these scripts may require valid `.env` file. Copy `.env.example` as `.env` and fill it out.

- `scripts/deployMainnet.ts` - deploys a full solution to forked mainnet and optimism testnet on kovan. Run with
  `yarn deploy:mainnet-fork`
- `scripts/deployKovan.ts` - deploys a full solution to kovan and optimism testnet on kovan. Run with
  `yarn deploy:kovan`

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
L1DAI: 0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa # part of MCD deployment on kovan: https://changelog.makerdao.com/
L1Escrow:  0x42cE949bda03A1B9e8785a6005C9A18DfdBf5037
L1DAITokenBridge:  0xE3C6629173013F7c8fCAC64e77Fb454948748806
L1Governance Relay:  0x675383242Dbc07C8e130393037aa4C40cb06e1F3
L2DAI:  0x8b4E5Ab8c90AF4FBCB8a71A86bdC340d9151c96d
L2DAITokenBridge:  0x506096F7c814188123b538414AbB19BA44B447D9
L2Governance Relay:  0x90028dB7CE760ea6e30F88573F335026e05fAA19
```
