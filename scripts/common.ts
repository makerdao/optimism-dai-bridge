import { Dai, L1DAITokenBridge, L1Escrow, L1GovernanceRelay, L2DAITokenBridge, L2GovernanceRelay } from '../typechain'
import { deployUsingFactory, getL2Factory, MAX_UINT256, waitForTx } from '../test-e2e/helpers/utils'
import { Signer } from '@ethersproject/abstract-signer'
import { expect } from 'chai'
import { getActiveWards } from '../test-e2e/helpers/auth'
import { ethers as l1 } from 'hardhat'
import { getContractAddress } from 'ethers/lib/utils'
import { getAddressOfNextDeployedContract } from '../test-e2e/helpers/address'

interface Options {
  l1Deployer: Signer
  l2Deployer: Signer

  L1_XDOMAIN_MESSENGER: string
  L2_XDOMAIN_MESSENGER: string
  L1_DAI_ADDRESS: string
  L1_PAUSE_PROXY_ADDRESS: string
  L1_ESM_ADDRESS: string

  L1_TX_OPTS: Object
  L2_TX_OPTS: Object
}

export async function deploy(opts: Options) {
  // Bridge deploy
  const l1Escrow = await deployUsingFactory(opts.l1Deployer, await l1.getContractFactory('L1Escrow'), [opts.L1_TX_OPTS])
  console.log('L1Escrow: ', l1Escrow.address)
  const l2Dai = await deployUsingFactory(opts.l2Deployer, await getL2Factory('Dai'), [opts.L2_TX_OPTS])
  console.log('L2DAI: ', l2Dai.address)
  const futureL1DAITokenBridgeAddress = await getAddressOfNextDeployedContract(opts.l1Deployer)
  const l2DAITokenBridge = await deployUsingFactory(opts.l2Deployer, await getL2Factory('L2DAITokenBridge'), [
    opts.L2_XDOMAIN_MESSENGER,
    l2Dai.address,
    opts.L1_DAI_ADDRESS,
    futureL1DAITokenBridgeAddress,
    opts.L2_TX_OPTS,
  ])
  console.log('L2DAITokenBridge: ', l2DAITokenBridge.address)
  const l1DAITokenBridge = await deployUsingFactory(opts.l1Deployer, await l1.getContractFactory('L1DAITokenBridge'), [
    opts.L1_DAI_ADDRESS,
    l2DAITokenBridge.address,
    l2Dai.address,
    opts.L1_XDOMAIN_MESSENGER,
    l1Escrow.address,
    opts.L1_TX_OPTS,
  ])
  expect(l1DAITokenBridge.address).to.be.eq(
    futureL1DAITokenBridgeAddress,
    'Predicted address of l1DAITokenBridge doesnt match actual address',
  )
  console.log('L1DAITokenBridge: ', l1DAITokenBridge.address)

  // Governance deploy
  const futureL1GovRelayAddress = await getAddressOfNextDeployedContract(opts.l1Deployer)
  const l2GovernanceRelay = await deployUsingFactory(opts.l2Deployer, await getL2Factory('L2GovernanceRelay'), [
    opts.L2_XDOMAIN_MESSENGER,
    futureL1GovRelayAddress,
    opts.L2_TX_OPTS,
  ])
  console.log('L2Governance Relay: ', l2GovernanceRelay.address)
  const l1GovernanceRelay = await deployUsingFactory(
    opts.l1Deployer,
    await l1.getContractFactory('L1GovernanceRelay'),
    [l2GovernanceRelay.address, opts.L1_XDOMAIN_MESSENGER, opts.L1_TX_OPTS],
  )
  expect(l1GovernanceRelay.address).to.be.eq(
    futureL1GovRelayAddress,
    'Predicted address of l1GovernanceRelay doesnt match actual address',
  )
  console.log('L1Governance Relay: ', l1GovernanceRelay.address)

  // Permissions
  console.log('Finalizing permissions for L1Escrow...')
  await waitForTx(
    l1Escrow
      .connect(opts.l1Deployer)
      .approve(opts.L1_DAI_ADDRESS, l1DAITokenBridge.address, MAX_UINT256, opts.L1_TX_OPTS),
  )
  await waitForTx(l1Escrow.connect(opts.l1Deployer).rely(opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1Escrow.connect(opts.l1Deployer).rely(opts.L1_ESM_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1Escrow.connect(opts.l1Deployer).deny(await opts.l1Deployer.getAddress(), opts.L1_TX_OPTS))

  console.log('Finalizing permissions for L2DAI...')
  await waitForTx(l2Dai.rely(l2DAITokenBridge.address, opts.L2_TX_OPTS))
  await waitForTx(l2Dai.rely(l2GovernanceRelay.address, opts.L2_TX_OPTS))
  await waitForTx(l2Dai.deny(await opts.l2Deployer.getAddress(), opts.L2_TX_OPTS))

  console.log('Finalizing permissions for L1DAITokenBridge...')
  await waitForTx(l1DAITokenBridge.rely(opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1DAITokenBridge.rely(opts.L1_ESM_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1DAITokenBridge.deny(await opts.l1Deployer.getAddress(), opts.L1_TX_OPTS))

  console.log('Finalizing permissions for L2DAITokenBridge...')
  await waitForTx(l2DAITokenBridge.rely(l2GovernanceRelay.address, opts.L2_TX_OPTS))
  await waitForTx(l2DAITokenBridge.deny(await opts.l2Deployer.getAddress(), opts.L2_TX_OPTS))

  console.log('Finalizing permissions for L1GovernanceRelay...')
  await waitForTx(l1GovernanceRelay.rely(opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1GovernanceRelay.rely(opts.L1_ESM_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1GovernanceRelay.deny(await opts.l1Deployer.getAddress(), opts.L1_TX_OPTS))

  console.log('Permission sanity checks...')
  expect(await getActiveWards(l1Escrow)).to.deep.eq([opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_ESM_ADDRESS])
  expect(await getActiveWards(l1DAITokenBridge)).to.deep.eq([opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_ESM_ADDRESS])
  expect(await getActiveWards(l1GovernanceRelay)).to.deep.eq([opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_ESM_ADDRESS])
  expect(await getActiveWards(l2DAITokenBridge)).to.deep.eq([l2GovernanceRelay.address])
  expect(await getActiveWards(l2Dai)).to.deep.eq([l2DAITokenBridge.address, l2GovernanceRelay.address])

  return {
    l1Escrow,
    l1DAITokenBridge,
    l1GovernanceRelay,
    l2Dai,
    l2DAITokenBridge,
    l2GovernanceRelay,
  }
}
