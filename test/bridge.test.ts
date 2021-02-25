import { Watcher } from '@eth-optimism/watcher'
import { Wallet } from '@ethersproject/wallet'
import { expect } from 'chai'
import { Contract, providers } from 'ethers'

import { artifacts } from './helpers/artifacts'
import { optimismConfig } from './helpers/optimismConfig'
import {
  deployContract,
  printRollupStatus,
  q18,
  setupTest,
  waitForTx,
  waitToRelayMessageToL1,
  waitToRelayTxsToL2,
} from './helpers/utils'

describe('bridge', () => {
  let l1Provider: providers.BaseProvider
  let l2Provider: providers.BaseProvider
  let l1Signer: Wallet
  let l2Signer: Wallet
  let watcher: Watcher

  let l1Dai: Contract
  let l1DaiDeposit: Contract
  let l2Dai: Contract
  let l2Minter: Contract
  const initialL1DaiNumber = q18(10000)

  beforeEach(async () => {
    ;({ l1Provider, l2Provider, l1Signer, l2Signer, watcher } = await setupTest())
    l1Dai = await deployContract(l1Signer, artifacts.l1.token, [initialL1DaiNumber, 'DAI', 18, 'DAI'])
    console.log('L1 DAI: ', l1Dai.address)

    const chainId = (await l2Provider.getNetwork()).chainId
    l2Dai = await deployContract(l2Signer, artifacts.l2.dai, [chainId])
    console.log('L2 DAI: ', l2Dai.address)

    l2Minter = await deployContract(l2Signer, artifacts.l2.minter, [l2Dai.address])
    console.log('L2 Minter: ', l2Minter.address)
    await waitForTx(l2Dai.rely(l2Minter.address))

    l1DaiDeposit = await deployContract(l1Signer, artifacts.l1.tokenDeposit, [
      l1Dai.address,
      l2Minter.address,
      optimismConfig.Proxy__OVM_L1CrossDomainMessenger,
    ])
    console.log('L1 DAI Deposit: ', l1DaiDeposit.address)

    await waitForTx(l2Minter.init(optimismConfig._L2_OVM_L2CrossDomainMessenger, l1DaiDeposit.address))
    console.log('L2 DAI initialized...')
  })

  it('moves l1 tokens to l2', async () => {
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDeposit.address, depositAmount))
    await waitForTx(l1DaiDeposit.deposit(await l1Signer.getAddress(), depositAmount))

    await waitToRelayTxsToL2(l1Provider)

    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)
  })

  it('moves l2 tokens to l1', async () => {
    const depositAmount = q18(500)
    await waitForTx(l1Dai.approve(l1DaiDeposit.address, depositAmount))
    await waitForTx(l1DaiDeposit.deposit(await l1Signer.getAddress(), depositAmount))

    await printRollupStatus(l1Provider)
    await waitToRelayTxsToL2(l1Provider)
    await printRollupStatus(l1Provider)
    const balance = await l2Dai.balanceOf(l1Signer.address)
    expect(balance.toString()).to.be.eq(depositAmount)

    await printRollupStatus(l1Provider)
    await waitForTx(l2Dai.approve(l2Minter.address, depositAmount))

    await waitToRelayMessageToL1(l2Minter.withdraw(depositAmount), watcher)

    const balanceAfterWithdrawal = await l2Dai.balanceOf(l1Signer.address)
    expect(balanceAfterWithdrawal.toString()).to.be.eq('0')
    const l1Balance = await l1Dai.balanceOf(l1Signer.address)
    expect(l1Balance.toString()).to.be.eq(initialL1DaiNumber)
  })
})
