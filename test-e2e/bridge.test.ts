import { Wallet } from '@ethersproject/wallet'
import { expect } from 'chai'
import { ethers as l1 } from 'hardhat'

import {
  Dai,
  L1DAITokenBridge,
  L1Escrow,
  L1GovernanceRelay,
  L2DAITokenBridge,
  L2GovernanceRelay,
  TestBridgeUpgradeSpell,
} from '../typechain'
import { getActiveWards } from './helpers/auth'
import { optimismConfig } from './helpers/optimismConfig'
import {
  deployUsingFactory,
  getL2Factory,
  MAX_UINT256,
  q18,
  setupTest,
  waitForTx,
  waitToRelayMessageToL1,
  waitToRelayTxsToL2,
  ZERO_GAS_OPTS,
} from './helpers/utils'

const defaultGasLimit = 1000000

describe('bridge', () => {
  let l1Signer: Wallet
  let l1Escrow: L1Escrow
  let l2Signer: Wallet
  let watcher: any

  let l1Dai: Dai
  let l1DaiDeposit: L1DAITokenBridge
  let l1DaiDepositV2: L1DAITokenBridge
  let l1GovernanceRelay: L1GovernanceRelay
  let l2Dai: Dai
  let l2DAITokenBridge: L2DAITokenBridge
  let l2GatewayV2: L2DAITokenBridge
  let l2GovernanceRelay: L2GovernanceRelay
  let l2UpgradeSpell: TestBridgeUpgradeSpell
  const initialL1DaiNumber = q18(10000)
  const spellGasLimit = 5000000

  beforeEach(async () => {
    ;({ l1Signer, l2Signer, watcher } = await setupTest())
    l1Dai = await deployUsingFactory(l1Signer, await l1.getContractFactory('Dai'), [ZERO_GAS_OPTS])
    console.log('L1 DAI: ', l1Dai.address)
    await waitForTx(l1Dai.mint(l1Signer.address, initialL1DaiNumber))

    l2Dai = await deployUsingFactory(l2Signer, await getL2Factory('Dai'), [ZERO_GAS_OPTS])
    console.log('L2 DAI: ', l2Dai.address)

    l2DAITokenBridge = await deployUsingFactory(l2Signer, await getL2Factory('L2DAITokenBridge'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      l2Dai.address,
      l1Dai.address,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 DAI Token Bridge: ', l2DAITokenBridge.address)

    l1Escrow = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1Escrow'), [ZERO_GAS_OPTS])
    console.log('L1 Escrow: ', l1Escrow.address)

    l1DaiDeposit = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1DAITokenBridge'), [
      l1Dai.address,
      l2DAITokenBridge.address,
      l2Dai.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Escrow.address,
      ZERO_GAS_OPTS,
    ])
    await waitForTx(l1Escrow.approve(l1Dai.address, l1DaiDeposit.address, MAX_UINT256))
    console.log('L1 DAI Deposit: ', l1DaiDeposit.address)

    await waitForTx(l2DAITokenBridge.init(l1DaiDeposit.address, ZERO_GAS_OPTS))
    console.log('L2 DAI initialized...')

    l2GovernanceRelay = await deployUsingFactory(l2Signer, await getL2Factory('L2GovernanceRelay'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 Governance Relay: ', l2DAITokenBridge.address)

    l1GovernanceRelay = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1GovernanceRelay'), [
      l2GovernanceRelay.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      ZERO_GAS_OPTS,
    ])
    console.log('L1 Governance Relay: ', l1GovernanceRelay.address)

    await waitForTx(l2GovernanceRelay.init(l1GovernanceRelay.address, ZERO_GAS_OPTS))
    console.log('Governance relay initialized...')

    await waitForTx(l2Dai.rely(l2DAITokenBridge.address, ZERO_GAS_OPTS))
    await waitForTx(l2Dai.rely(l2GovernanceRelay.address, ZERO_GAS_OPTS))
    await waitForTx(l2Dai.deny(l2Signer.address, ZERO_GAS_OPTS))
    await waitForTx(l2DAITokenBridge.rely(l2GovernanceRelay.address, ZERO_GAS_OPTS))
    await waitForTx(l2DAITokenBridge.deny(l2Signer.address, ZERO_GAS_OPTS))
    console.log('Permission sanity checks...')
    expect(await getActiveWards(l2Dai)).to.deep.eq([l2DAITokenBridge.address, l2GovernanceRelay.address])
    expect(await getActiveWards(l2DAITokenBridge)).to.deep.eq([l2GovernanceRelay.address])
    console.log('Permissions updated.')
  })

  it('moves l1 tokens to l2', async () => {
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDeposit.address, depositAmount))
    await waitToRelayTxsToL2(
      l1DaiDeposit.depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGasLimit, '0x'),
      watcher,
    )

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)
  })

  it('moves l2 tokens to l1', async () => {
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDeposit.address, depositAmount))
    await waitToRelayTxsToL2(
      l1DaiDeposit.depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGasLimit, '0x'),
      watcher,
    )

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await waitForTx(l2Dai.approve(l2DAITokenBridge.address, depositAmount, ZERO_GAS_OPTS))
    await waitToRelayMessageToL1(
      l2DAITokenBridge.withdraw(l2Dai.address, depositAmount, defaultGasLimit, '0x', ZERO_GAS_OPTS),
      watcher,
    )

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })

  it('upgrades the bridge through governance relay', async () => {
    l2GatewayV2 = await deployUsingFactory(l2Signer, await getL2Factory('L2DAITokenBridge'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      l2Dai.address,
      l1Dai.address,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 DAI Token Bridge V2: ', l2GatewayV2.address)

    l1DaiDepositV2 = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1DAITokenBridge'), [
      l1Dai.address,
      l2GatewayV2.address,
      l2Dai.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Escrow.address,
      ZERO_GAS_OPTS,
    ])
    await waitForTx(l1Escrow.approve(l1Dai.address, l1DaiDepositV2.address, MAX_UINT256, ZERO_GAS_OPTS))
    console.log('L1 DAI Deposit V2: ', l1DaiDepositV2.address)

    await waitForTx(l2GatewayV2.init(l1DaiDepositV2.address, ZERO_GAS_OPTS))
    console.log('L2 Bridge initialized...')

    l2UpgradeSpell = await deployUsingFactory(l2Signer, await getL2Factory('TestBridgeUpgradeSpell'), [ZERO_GAS_OPTS])
    console.log('L2 Bridge Upgrade Spell: ', l2UpgradeSpell.address)

    // Close L1 bridge V1
    await l1DaiDeposit.connect(l1Signer).close(ZERO_GAS_OPTS)
    console.log('L1 Bridge Closed')

    // Close L2 bridge V1
    await l1GovernanceRelay
      .connect(l1Signer)
      .relay(
        l2UpgradeSpell.address,
        l2UpgradeSpell.interface.encodeFunctionData('upgradeBridge', [l2DAITokenBridge.address, l2GatewayV2.address]),
        spellGasLimit,
        ZERO_GAS_OPTS,
      )
    console.log('L2 Bridge Closed')

    console.log('Testing V2 bridge deposit/withdrawal...')
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDepositV2.address, depositAmount, ZERO_GAS_OPTS))
    await waitToRelayTxsToL2(
      l1DaiDepositV2.depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGasLimit, '0x', ZERO_GAS_OPTS),
      watcher,
    )

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await waitForTx(l2Dai.approve(l2GatewayV2.address, depositAmount, ZERO_GAS_OPTS))
    await waitToRelayMessageToL1(
      l2GatewayV2.withdraw(l2Dai.address, depositAmount, defaultGasLimit, '0x', ZERO_GAS_OPTS),
      watcher,
    )

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })
})
