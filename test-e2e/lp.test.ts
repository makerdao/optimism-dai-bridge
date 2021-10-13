import { Wallet } from '@ethersproject/wallet'
import { deployUsingFactory, getAddressOfNextDeployedContract, waitForTx } from '@makerdao/hardhat-utils'
import { expect } from 'chai'
import { utils } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { ethers, ethers as l1 } from 'hardhat'

import { getL2Factory, optimismConfig, waitToRelayMessageToL1, waitToRelayTxsToL2, ZERO_GAS_OPTS } from '../optimism-helpers'
import { Dai, L1DAITokenBridge, L1Escrow, L2DAITokenBridge } from '../typechain'
import { setupTest } from './helpers'

const L2_MESSENGER_ABI = [{ inputs: [], name: 'messageNonce', outputs: [{ type: 'uint256' }], stateMutability: 'view', type: 'function' }]
const defaultGasLimit = 1000000
const depositAmount = parseUnits('500', 'ether')
const fee = parseUnits('1', 'ether')
const initialL1DaiAmount = parseUnits('10000', 'ether')

describe('bridge', () => {
  let l1Signer: Wallet
  let l2Signer: Wallet
  let l1User: Wallet
  let l2User: Wallet
  let l1Escrow: L1Escrow
  let l2Messenger: any
  let lp: any
  let watcher: any

  let l1Dai: Dai
  let l1DAITokenBridge: L1DAITokenBridge

  let l2Dai: Dai
  let l2DAITokenBridge: L2DAITokenBridge

  beforeEach(async () => {
    ;({ l1Signer, l2Signer, l1User, l2User, watcher } = await setupTest())

    l1Dai = await deployUsingFactory(l1Signer, await l1.getContractFactory('Dai'), [ZERO_GAS_OPTS])
    console.log('L1 DAI: ', l1Dai.address)
    await waitForTx(l1Dai.mint(l1Signer.address, initialL1DaiAmount))
    await waitForTx(l1Dai.mint(l1User.address, initialL1DaiAmount))

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
    expect(l1DAITokenBridge.address).to.be.eq(futureL1DAITokenBridgeAddress, 'Predicted address of l1DAITokenBridge doesnt match actual address')
    console.log('L1 DAI Deposit: ', l1DAITokenBridge.address)

    await waitForTx(l2Dai.rely(l2DAITokenBridge.address, ZERO_GAS_OPTS))
    await waitForTx(l2Dai.deny(l2Signer.address, ZERO_GAS_OPTS))
    await waitForTx(l2DAITokenBridge.deny(l2Signer.address, ZERO_GAS_OPTS))

    l2Messenger = await ethers.getContractAt(L2_MESSENGER_ABI, optimismConfig._L2_OVM_L2CrossDomainMessenger, l2Signer)
    lp = await deployUsingFactory(l1Signer, await l1.getContractFactory('LiquidityProvider'), [
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      ZERO_GAS_OPTS,
    ])
    console.log('LP: ', lp.address)
    await lp.registerL1Token(l1Dai.address, l1DAITokenBridge.address)
    await lp.registerL2Token(l2Dai.address, l2DAITokenBridge.address)
  })

  async function deposit() {
    console.log('Depositing...')
    await waitForTx(l1Dai.connect(l1User).approve(l1DAITokenBridge.address, depositAmount))
    await waitToRelayTxsToL2(
      l1DAITokenBridge.connect(l1User).depositERC20(l1Dai.address, l2Dai.address, depositAmount, defaultGasLimit, '0x'),
      watcher,
    )

    // check post-deposit state
    const userL2Balance = await l2Dai.balanceOf(l2User.address)
    expect(userL2Balance.toString()).to.be.eq(depositAmount)
    const userL1Balance = await l1Dai.balanceOf(l1User.address)
    expect(userL1Balance.toString()).to.be.eq(initialL1DaiAmount.sub(depositAmount))
  }

  async function withdraw() {
    console.log('Withdrawing...')
    const messageNonce = parseInt(await l2Messenger.messageNonce())
    const extraData = new utils.AbiCoder().encode(['address', 'uint256'], [l2User.address, fee])
    await waitToRelayMessageToL1(
      l2DAITokenBridge.connect(l2User).withdrawTo(l2Dai.address, lp.address, depositAmount, defaultGasLimit, extraData, ZERO_GAS_OPTS),
      watcher,
    )

    // check post-withdrawal state
    const userL2Balance = await l2Dai.balanceOf(l2User.address)
    expect(userL2Balance.toString()).to.be.eq('0')
    const lpL1Balance = await l1Dai.balanceOf(lp.address)
    expect(lpL1Balance.toString()).to.be.eq(depositAmount)
    const wasWithdrawn = await lp.wasWithdrawn(l1Dai.address, l2Dai.address, l1User.address, l2User.address, depositAmount, fee, messageNonce)
    expect(wasWithdrawn).to.be.true

    return messageNonce
  }

  it('allows LP to claim funds after successful fast withdrawal', async () => {
    await deposit()
    const messageNonce = await withdraw()

    await waitForTx(l1Dai.approve(lp.address, depositAmount.sub(fee)))
    console.log('Processing Fast Withdrawal...')
    await waitForTx(lp.processFastWithdrawal(l1Dai.address, l1Signer.address, l1User.address, depositAmount, fee, messageNonce))

    // check post-fast-withdrawal state
    let userL1Balance = await l1Dai.balanceOf(l1User.address)
    expect(userL1Balance.toString()).to.be.eq(initialL1DaiAmount.sub(fee))
    let inventoryL1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(inventoryL1Balance.toString()).to.be.eq(initialL1DaiAmount.sub(depositAmount).add(fee))
    let lpL1Balance = await l1Dai.balanceOf(lp.address)
    expect(lpL1Balance.toString()).to.be.eq(depositAmount)

    console.log('Claiming...')
    await waitForTx(lp.claim(l1Dai.address, l2Dai.address, l2User.address, l1User.address, depositAmount, fee, messageNonce))

    // check post-claim state
    userL1Balance = await l1Dai.balanceOf(l1User.address)
    expect(userL1Balance.toString()).to.be.eq(initialL1DaiAmount.sub(fee))
    inventoryL1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(inventoryL1Balance.toString()).to.be.eq(initialL1DaiAmount.add(fee))
    lpL1Balance = await l1Dai.balanceOf(lp.address)
    expect(lpL1Balance.toString()).to.be.eq('0')
  })

  it('allows user to claim funds if no fast withdrawal took place', async () => {
    await deposit()
    const messageNonce = await withdraw()

    console.log('Claiming...')
    await waitForTx(lp.connect(l1User).claim(l1Dai.address, l2Dai.address, l2User.address, l1User.address, depositAmount, fee, messageNonce))

    // check post-claim state
    const userL1Balance = await l1Dai.balanceOf(l1User.address)
    expect(userL1Balance.toString()).to.be.eq(initialL1DaiAmount)
    const inventoryL1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(inventoryL1Balance.toString()).to.be.eq(initialL1DaiAmount)
    const lpL1Balance = await l1Dai.balanceOf(lp.address)
    expect(lpL1Balance.toString()).to.be.eq('0')
  })
})
