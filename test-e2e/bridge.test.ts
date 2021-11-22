import { Watcher } from '@eth-optimism/core-utils'
import { Wallet } from '@ethersproject/wallet'
import {
  deployUsingFactory,
  getActiveWards,
  getAddressOfNextDeployedContract,
  waitForTx,
} from '@makerdao/hardhat-utils'
import { expect } from 'chai'
import { parseUnits } from 'ethers/lib/utils'
import { ethers, ethers as l1 } from 'hardhat'

import { optimismConfig, relayMessagesToL1, waitToRelayTxsToL2, ZERO_GAS_OPTS } from '../optimism-helpers'
import {
  Dai,
  L1DAITokenBridge,
  L1Escrow,
  L1GovernanceRelay,
  L2DAITokenBridge,
  L2GovernanceRelay,
  TestBridgeUpgradeSpell,
} from '../typechain-types'
import { setupTest } from './helpers'

const defaultGasLimit = 1000000
const spellGasLimit = 5000000
const depositAmount = parseUnits('500', 'ether')
const initialL1DaiNumber = parseUnits('10000', 'ether')

describe('bridge', () => {
  let l1Signer: Wallet
  let l1Escrow: L1Escrow
  let l2Signer: Wallet
  let watcher: Watcher

  let l1Dai: Dai
  let l1DAITokenBridge: L1DAITokenBridge
  let l1DAITokenBridgeV2: L1DAITokenBridge
  let l1GovernanceRelay: L1GovernanceRelay
  let l2Dai: Dai
  let l2DAITokenBridge: L2DAITokenBridge
  let l2DAITokenBridgeV2: L2DAITokenBridge
  let l2GovernanceRelay: L2GovernanceRelay
  let l2UpgradeSpell: TestBridgeUpgradeSpell

  beforeEach(async () => {
    ;({ l1Signer, l2Signer, watcher } = await setupTest())
    l1Dai = await deployUsingFactory(l1Signer, await l1.getContractFactory('Dai'), [ZERO_GAS_OPTS])
    console.log('L1 DAI: ', l1Dai.address)
    await waitForTx(l1Dai.mint(l1Signer.address, initialL1DaiNumber))

    l2Dai = await deployUsingFactory(l2Signer, await l1.getContractFactory('Dai'), [ZERO_GAS_OPTS])
    console.log('L2 DAI: ', l2Dai.address)

    l1Escrow = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1Escrow'), [ZERO_GAS_OPTS])
    console.log('L1 Escrow: ', l1Escrow.address)

    const futureL1DAITokenBridgeAddress = await getAddressOfNextDeployedContract(l1Signer)
    l2DAITokenBridge = await deployUsingFactory(l2Signer, await l1.getContractFactory('L2DAITokenBridge'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      l2Dai.address,
      l1Dai.address,
      futureL1DAITokenBridgeAddress,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 DAI Token Bridge: ', l2DAITokenBridge.address)

    l1DAITokenBridge = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1DAITokenBridge'), [
      l1Dai.address,
      l2DAITokenBridge.address,
      l2Dai.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Escrow.address,
      ZERO_GAS_OPTS,
    ])
    await waitForTx(l1Escrow.approve(l1Dai.address, l1DAITokenBridge.address, ethers.constants.MaxUint256))
    expect(l1DAITokenBridge.address).to.be.eq(
      futureL1DAITokenBridgeAddress,
      'Predicted address of l1DAITokenBridge doesnt match actual address',
    )
    console.log('L1 DAI Deposit: ', l1DAITokenBridge.address)

    const futureL1GovRelayAddress = await getAddressOfNextDeployedContract(l1Signer)
    l2GovernanceRelay = await deployUsingFactory(l2Signer, await l1.getContractFactory('L2GovernanceRelay'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      futureL1GovRelayAddress,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 Governance Relay: ', l2DAITokenBridge.address)

    l1GovernanceRelay = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1GovernanceRelay'), [
      l2GovernanceRelay.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      ZERO_GAS_OPTS,
    ])
    expect(l1GovernanceRelay.address).to.be.eq(
      futureL1GovRelayAddress,
      'Predicted address of l1GovernanceRelay doesnt match actual address',
    )
    console.log('L1 Governance Relay: ', l1GovernanceRelay.address)

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
    await waitForTx(l1Dai.approve(l1DAITokenBridge.address, depositAmount))
    await waitToRelayTxsToL2(
      l1DAITokenBridge.depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGasLimit, '0x'),
      watcher,
    )

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)
  })

  it('moves l2 tokens to l1', async () => {
    await waitForTx(l1Dai.approve(l1DAITokenBridge.address, depositAmount))
    await waitToRelayTxsToL2(
      l1DAITokenBridge.depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGasLimit, '0x'),
      watcher,
    )

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await relayMessagesToL1(
      l2DAITokenBridge.withdraw(l2Dai.address, depositAmount, defaultGasLimit, '0x', ZERO_GAS_OPTS),
      watcher,
      l1Signer,
    )

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })

  it('upgrades the bridge through governance relay', async () => {
    const futureL2DAITokenBridgeV2Address = await getAddressOfNextDeployedContract(l1Signer)
    l2DAITokenBridgeV2 = await deployUsingFactory(l2Signer, await l1.getContractFactory('L2DAITokenBridge'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      l2Dai.address,
      l1Dai.address,
      futureL2DAITokenBridgeV2Address,
      ZERO_GAS_OPTS,
    ])
    console.log('L2 DAI Token Bridge V2: ', l2DAITokenBridgeV2.address)

    l1DAITokenBridgeV2 = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1DAITokenBridge'), [
      l1Dai.address,
      l2DAITokenBridgeV2.address,
      l2Dai.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Escrow.address,
      ZERO_GAS_OPTS,
    ])
    expect(l1DAITokenBridgeV2.address).to.be.eq(
      futureL2DAITokenBridgeV2Address,
      'Predicted address of l1DAITokenBridgeV2 doesnt match actual address',
    )
    await waitForTx(
      l1Escrow.approve(l1Dai.address, l1DAITokenBridgeV2.address, ethers.constants.MaxUint256, ZERO_GAS_OPTS),
    )
    console.log('L1 DAI Deposit V2: ', l1DAITokenBridgeV2.address)

    l2UpgradeSpell = await deployUsingFactory(l2Signer, await l1.getContractFactory('TestBridgeUpgradeSpell'), [
      ZERO_GAS_OPTS,
    ])
    console.log('L2 Bridge Upgrade Spell: ', l2UpgradeSpell.address)

    // Close L1 bridge V1
    await l1DAITokenBridge.connect(l1Signer).close(ZERO_GAS_OPTS)
    console.log('L1 Bridge Closed')

    // Close L2 bridge V1
    console.log('Executing spell to close L2 Bridge v1 and grant minting permissions to L2 Bridge v2')
    await waitToRelayTxsToL2(
      l1GovernanceRelay
        .connect(l1Signer)
        .relay(
          l2UpgradeSpell.address,
          l2UpgradeSpell.interface.encodeFunctionData('upgradeBridge', [
            l2DAITokenBridge.address,
            l2DAITokenBridgeV2.address,
          ]),
          spellGasLimit,
          ZERO_GAS_OPTS,
        ),
      watcher,
    )
    console.log('L2 Bridge Closed')

    console.log('Testing V2 bridge deposit/withdrawal...')
    await waitForTx(l1Dai.approve(l1DAITokenBridgeV2.address, depositAmount, ZERO_GAS_OPTS))
    await waitToRelayTxsToL2(
      l1DAITokenBridgeV2.depositERC20(
        l1Dai.address,
        l2Dai.address,
        depositAmount,
        defaultGasLimit,
        '0x',
        ZERO_GAS_OPTS,
      ),
      watcher,
    )

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await relayMessagesToL1(
      l2DAITokenBridgeV2.withdraw(l2Dai.address, depositAmount, defaultGasLimit, '0x', ZERO_GAS_OPTS),
      watcher,
      l1Signer,
    )

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })
})
