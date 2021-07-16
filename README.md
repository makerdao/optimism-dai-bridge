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

- `scripts/deployMainnet.ts` - deploys a full solution to mainnet and optimism mainnet. Run with `yarn deploy:mainnet`
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

Before starting, make sure Slither is installed:
```
$ pip3 install slither-analyzer
```

To quickly test Echidna in Linux or MacOS: [release page](https://github.com/crytic/echidna/releases)

### Local Dependencies

- Slither:
  ```
  $ pip3 install slither-analyzer
  ```
- solc-select:
  ```
  $ pip3 install solc-select
  ```

### Run Echidna Tests

- Install solc version:
  ```
  $ solc-select install 0.7.6
  ```
- Select solc version:
  ```
  $ solc-select use 0.7.6
  ```
- Run Echidna Tests:
  ```
  $ echidna-test . --contract DaiEchidnaTest --config echidna.config.yml
  ```

## Deployments:

### Mainnet:

```json
{
  "l1Dai": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  "l1Escrow": "0x467194771dAe2967Aef3ECbEDD3Bf9a310C76C65",
  "l1DAITokenBridge": "0x10E6593CDda8c58a1d0f14C5164B376352a55f2F",
  "l1GovernanceRelay": "0x09B354CDA89203BB7B3131CC728dFa06ab09Ae2F",
  "l2Dai": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  "l2DAITokenBridge": "0x467194771dAe2967Aef3ECbEDD3Bf9a310C76C65",
  "l2GovernanceRelay": "0x10E6593CDda8c58a1d0f14C5164B376352a55f2F"
}
```

### Kovan:

```json
{
  "l1Dai": "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa",
  "l1Escrow": "0x8FdA2c4323850F974C7Abf4B16eD129D45f9E2e2",
  "l1DAITokenBridge": "0xb415e822C4983ecD6B1c1596e8a5f976cf6CD9e3",
  "l1GovernanceRelay": "0xAeFc25750d8C2bd331293076E2DC5d5ad414b4a2",
  "l2Dai": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
  "l2DAITokenBridge": "0x467194771dAe2967Aef3ECbEDD3Bf9a310C76C65",
  "l2GovernanceRelay": "0x10E6593CDda8c58a1d0f14C5164B376352a55f2F"
}
```
