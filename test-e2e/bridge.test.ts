import { Wallet } from '@ethersproject/wallet'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers as l1, l2ethers as l2 } from 'hardhat'

import { Dai, L1ERC20Deposit, L2ERC20Minter } from '../typechain'
import { optimismConfig } from './helpers/optimismConfig'
import {
  deployContract,
  MAX_UINT256,
  q18,
  setupTest,
  waitForTx,
  waitToRelayMessageToL1,
  waitToRelayTxsToL2,
} from './helpers/utils'

describe('bridge', () => {
  let l1Signer: Wallet
  let l1Escrow: Wallet
  let l2Signer: Wallet
  let watcher: any

  let l1Dai: Dai
  let l1DaiDeposit: Contract
  let l2Dai: Contract
  let l2Minter: Contract
  const initialL1DaiNumber = q18(10000)

  beforeEach(async () => {
    ;({ l1Signer, l2Signer, watcher, l1User: l1Escrow } = await setupTest())
    l1Dai = await deployContract<Dai>(l1Signer, await l1.getContractFactory('Dai'), [])
    console.log('L1 DAI: ', l1Dai.address)
    await waitForTx(l1Dai.mint(l1Signer.address, initialL1DaiNumber))

    l2Dai = await deployContract<Dai>(l2Signer, await l2.getContractFactory('Dai'), [])
    console.log('L2 DAI: ', l2Dai.address)

    l2Minter = await deployContract<L2ERC20Minter>(l2Signer, await l2.getContractFactory('L2ERC20Minter'), [
      optimismConfig._L2_OVM_L2CrossDomainMessenger,
      l2Dai.address,
    ])
    console.log('L2 Minter: ', l2Minter.address)
    await waitForTx(l2Dai.rely(l2Minter.address))

    l1DaiDeposit = await deployContract<L1ERC20Deposit>(l1Signer, await l1.getContractFactory('L1ERC20Deposit'), [
      l1Dai.address,
      l2Minter.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
      l1Escrow.address,
    ])
    await l1Dai.connect(l1Escrow).approve(l1DaiDeposit.address, MAX_UINT256)
    console.log('L1 DAI Deposit: ', l1DaiDeposit.address)

    await waitForTx(l2Minter.init(l1DaiDeposit.address))
    console.log('L2 DAI initialized...')
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

    await waitForTx(l2Dai.approve(l2Minter.address, depositAmount))
    await waitToRelayMessageToL1(l2Minter.withdraw(depositAmount), watcher)

    const l2BalanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(l2BalanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })
})
