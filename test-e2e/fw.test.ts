import { Wallet } from '@ethersproject/wallet'
import { deployUsingFactory, getAddressOfNextDeployedContract, waitForTx } from '@makerdao/hardhat-utils'
import { expect } from 'chai'
import { parseUnits } from 'ethers/lib/utils'
import { ethers, ethers as l1 } from 'hardhat'

import { getL2Factory, optimismConfig, ZERO_GAS_OPTS } from '../optimism-helpers'
import {
  Dai,
  L1DAITokenBridge,
  L1Escrow,
  L1FwOptimismDai,
  L1GovernanceRelay,
  L2DAITokenBridge,
  L2GovernanceRelay,
} from '../typechain'
import { setupTest } from './helpers'
import { getL2ToL1Messages, relayMessageToL1 } from './optimism'
import { getOracleAttestation } from './oracles'

const defaultGasLimit = 1000000
const depositAmount = parseUnits('500', 'ether')
const initialL1DaiNumber = parseUnits('10000', 'ether')

describe.only('fw', () => {
  let l1Signer: Wallet
  let l1Escrow: L1Escrow
  let l2Signer: Wallet

  let l1Dai: Dai
  let l1DAITokenBridge: L1DAITokenBridge
  let l1GovernanceRelay: L1GovernanceRelay
  let l2Dai: Dai
  let l2DAITokenBridge: L2DAITokenBridge
  let l2GovernanceRelay: L2GovernanceRelay
  let l1FwOptimismDai: L1FwOptimismDai

  beforeEach(async () => {
    ;({ l1Signer, l2Signer } = await setupTest())
    l1Dai = await deployUsingFactory(l1Signer, await l1.getContractFactory('Dai'), [ZERO_GAS_OPTS])
    console.log('L1 DAI: ', l1Dai.address)
    await waitForTx(l1Dai.mint(l1Signer.address, initialL1DaiNumber))

    l2Dai = await deployUsingFactory(l2Signer, await getL2Factory('Dai'), [ZERO_GAS_OPTS])
    console.log('L2 DAI: ', l2Dai.address)

    l1Escrow = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1Escrow'), [ZERO_GAS_OPTS])
    console.log('L1 Escrow: ', l1Escrow.address)

    const futureL1DAITokenBridgeAddress = await getAddressOfNextDeployedContract(l1Signer)
    l2DAITokenBridge = await deployUsingFactory(l2Signer, await getL2Factory('L2DAITokenBridge'), [
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
    l2GovernanceRelay = await deployUsingFactory(l2Signer, await getL2Factory('L2GovernanceRelay'), [
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

    l1FwOptimismDai = await deployUsingFactory(l1Signer, await l1.getContractFactory('L1FwOptimismDai'), [
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Dai.address,
      l1DAITokenBridge.address,
      l2DAITokenBridge.address,
      ZERO_GAS_OPTS,
    ])
    console.log('L1 FW Optimism DAI: ', l1FwOptimismDai.address)

    await waitForTx(l1Dai.rely(l1FwOptimismDai.address, ZERO_GAS_OPTS)) // tmp we allow fw to just mint new DAI directly
    await waitForTx(l2Dai.rely(l2DAITokenBridge.address, ZERO_GAS_OPTS))
    await waitForTx(l2Dai.rely(l2GovernanceRelay.address, ZERO_GAS_OPTS))
    await waitForTx(l2DAITokenBridge.rely(l2GovernanceRelay.address, ZERO_GAS_OPTS))
    // instead of depositing just mint tokens
    await waitForTx(l1Dai.mint(l1Escrow.address, depositAmount, ZERO_GAS_OPTS))
    await waitForTx(l2Dai.mint(l1Signer.address, depositAmount, ZERO_GAS_OPTS))
  })

  it.only('fast withdraws DAI', async () => {
    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    const messages = await getL2ToL1Messages(
      l2DAITokenBridge.withdraw(l2Dai.address, depositAmount, defaultGasLimit, '0x', ZERO_GAS_OPTS),
    )

    const mp = messages[0]

    await l1FwOptimismDai.fastWithdraw(
      mp.message.target,
      mp.message.sender,
      mp.message.message,
      mp.message.messageNonce,
      getOracleAttestation(mp.message.messageNonce),
    )

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber.add(depositAmount))
  })

  it('allows anyone to fw a message')
  it('reverts when trying withdraw message for wrong bridge/token')
  it('reverts if it was already withdrew')

  it('slow withdraws DAI', async () => {
    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await relayMessageToL1(
      l2DAITokenBridge.withdraw(l2Dai.address, depositAmount, defaultGasLimit, '0x', ZERO_GAS_OPTS),
      l1Signer,
    )

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber.add(depositAmount))
  })
})
