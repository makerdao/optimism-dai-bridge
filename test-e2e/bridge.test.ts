import { Wallet } from '@ethersproject/wallet'
import { expect } from 'chai'
import { ethers as l1 } from 'hardhat'

import {
  Dai,
  L1ERC20Gateway,
  L1Escrow,
  L1GovernanceRelay,
  L2DepositedToken,
  L2GovernanceRelay,
  TestBridgeUpgradeSpell,
} from '../typechain'
import { optimismConfig } from './helpers/optimismConfig'
import {
  deployContract,
  getL2Factory,
  MAX_UINT256,
  q18,
  setupTest,
  waitForTx,
  waitToRelayMessageToL1,
  waitToRelayTxsToL2,
  ZERO_GAS_OPTS,
} from './helpers/utils'

describe('bridge', () => {
  let l1Signer: Wallet
  let l1Escrow: L1Escrow
  let l2Signer: Wallet
  let watcher: any

  let l1Dai: Dai
  let l1DaiDeposit: L1ERC20Gateway
  let l1DaiDepositV2: L1ERC20Gateway
  let l1GovernanceRelay: L1GovernanceRelay
  let l2Dai: Dai
  let l2Minter: L2DepositedToken
  let l2MinterV2: L2DepositedToken
  let l2GovernanceRelay: L2GovernanceRelay
  let l2UpgradeSpell: TestBridgeUpgradeSpell
  const initialL1DaiNumber = q18(10000)
  const spellGasLimit = 5000000

  beforeEach(async () => {
    ;({ l1Signer, l2Signer, watcher } = await setupTest())
    l1Dai = await deployContract<Dai>(l1Signer, await l1.getContractFactory('Dai'), [ZERO_GAS_OPTS])
    console.log('L1 DAI: ', l1Dai.address)
    await waitForTx(l1Dai.mint(l1Signer.address, initialL1DaiNumber))

    l2Dai = await deployContract<Dai>(l2Signer, await getL2Factory('Dai'), [ZERO_GAS_OPTS])
    console.log('L2 DAI: ', l2Dai.address)

    l2Minter = await deployContract<L2DepositedToken>(l2Signer, await getL2Factory('L2DepositedToken'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      l2Dai.address,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 Minter: ', l2Minter.address)

    l1Escrow = await deployContract<L1Escrow>(l1Signer, await l1.getContractFactory('L1Escrow'), [ZERO_GAS_OPTS])

    l1DaiDeposit = await deployContract<L1ERC20Gateway>(l1Signer, await l1.getContractFactory('L1ERC20Gateway'), [
      l1Dai.address,
      l2Minter.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Escrow.address,
      ZERO_GAS_OPTS,
    ])
    await waitForTx(l1Escrow.approve(l1Dai.address, l1DaiDeposit.address, MAX_UINT256))
    console.log('L1 DAI Deposit: ', l1DaiDeposit.address)

    await waitForTx(l2Minter.init(l1DaiDeposit.address, ZERO_GAS_OPTS))
    console.log('L2 DAI initialized...')

    l2GovernanceRelay = await deployContract<L2GovernanceRelay>(l2Signer, await getL2Factory('L2GovernanceRelay'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 Governance Relay: ', l2Minter.address)

    l1GovernanceRelay = await deployContract<L1GovernanceRelay>(
      l1Signer,
      await l1.getContractFactory('L1GovernanceRelay'),
      [l2GovernanceRelay.address, optimismConfig.Proxy__OVM_L1CrossDomainMessenger, ZERO_GAS_OPTS],
    )
    console.log('L1 Governance Relay: ', l1GovernanceRelay.address)

    await waitForTx(l2GovernanceRelay.init(l1GovernanceRelay.address, ZERO_GAS_OPTS))
    console.log('Governance relay initialized...')

    await waitForTx(l2Dai.rely(l2Minter.address, ZERO_GAS_OPTS))
    await waitForTx(l2Dai.rely(l2GovernanceRelay.address, ZERO_GAS_OPTS))
    await waitForTx(l2Dai.deny(l2Signer.address, ZERO_GAS_OPTS))
    await waitForTx(l2Minter.transferOwnership(l2GovernanceRelay.address, ZERO_GAS_OPTS))
    console.log('Permissions updated...')
  })

  it('moves l1 tokens to l2', async () => {
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDeposit.address, depositAmount))
    await waitToRelayTxsToL2(l1DaiDeposit.deposit(depositAmount), watcher)

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)
  })

  it('moves l2 tokens to l1', async () => {
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDeposit.address, depositAmount))
    await waitToRelayTxsToL2(l1DaiDeposit.deposit(depositAmount), watcher)

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await waitForTx(l2Dai.approve(l2Minter.address, depositAmount, ZERO_GAS_OPTS))
    await waitToRelayMessageToL1(l2Minter.withdraw(depositAmount, ZERO_GAS_OPTS), watcher)

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })

  it('upgrades the bridge through governance relay', async () => {
    l2MinterV2 = await deployContract<L2DepositedToken>(l2Signer, await getL2Factory('L2DepositedToken'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      l2Dai.address,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 Minter V2: ', l2MinterV2.address)

    l1DaiDepositV2 = await deployContract<L1ERC20Gateway>(l1Signer, await l1.getContractFactory('L1ERC20Gateway'), [
      l1Dai.address,
      l2MinterV2.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Escrow.address,
      ZERO_GAS_OPTS,
    ])
    await waitForTx(l1Escrow.approve(l1Dai.address, l1DaiDepositV2.address, MAX_UINT256))
    console.log('L1 DAI Deposit V2: ', l1DaiDepositV2.address)

    await waitForTx(l2MinterV2.init(l1DaiDepositV2.address, ZERO_GAS_OPTS))
    console.log('L2 Bridge initialized...')

    l2UpgradeSpell = await deployContract<TestBridgeUpgradeSpell>(
      l2Signer,
      await getL2Factory('TestBridgeUpgradeSpell'),
      [],
    )
    console.log('L2 Bridge Upgrade Spell: ', l2UpgradeSpell.address)

    // Close L1 bridge V1
    await l1DaiDeposit.connect(l1Signer).close()
    console.log('L1 Bridge Closed')

    // Close L2 bridge V1
    await l1GovernanceRelay
      .connect(l1Signer)
      .relay(
        l2UpgradeSpell.address,
        l2UpgradeSpell.interface.encodeFunctionData('upgradeBridge', [l2Minter.address, l2MinterV2.address]),
        spellGasLimit,
      )
    console.log('L2 Bridge Closed')

    console.log('Testing V2 bridge deposit/withdrawal...')
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDepositV2.address, depositAmount))
    await waitToRelayTxsToL2(l1DaiDepositV2.deposit(depositAmount), watcher)

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await waitForTx(l2Dai.approve(l2MinterV2.address, depositAmount, ZERO_GAS_OPTS))
    await waitToRelayMessageToL1(l2MinterV2.withdraw(depositAmount, ZERO_GAS_OPTS), watcher)

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })
})
