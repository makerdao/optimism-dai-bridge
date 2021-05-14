import { Dai, L1Gateway, L1Escrow, L1GovernanceRelay, L2Gateway, L2GovernanceRelay } from '../typechain'
import { deployContract, getL2Factory, MAX_UINT256, waitForTx } from '../test-e2e/helpers/utils'
import { Signer } from '@ethersproject/abstract-signer'

interface Options {
  l1Deployer: Signer
  l2Deployer: Signer
  l1: { getContractFactory(n: string): Promise<any> }

  L1_XDOMAIN_MESSENGER: string
  L2_XDOMAIN_MESSENGER: string
  L1_DAI_ADDRESS: string
  L1_PAUSE_PROXY_ADDRESS: string
  L1_ESM_ADDRESS: string

  L1_TX_OPTS: any
  L2_TX_OPTS: any
}

export async function deploy(opts: Options) {
  // Bridge deploy
  const l1Escrow = await deployContract<L1Escrow>(opts.l1Deployer, await opts.l1.getContractFactory('L1Escrow'), [
    opts.L1_TX_OPTS,
  ])
  console.log('L1 Escrow: ', l1Escrow.address)
  const l2Dai = await deployContract<Dai>(opts.l2Deployer, await getL2Factory('Dai'), [opts.L2_TX_OPTS])
  console.log('L2 DAI: ', l2Dai.address)
  const l2Gateway = await deployContract<L2Gateway>(opts.l2Deployer, await getL2Factory('L2Gateway'), [
    opts.L2_XDOMAIN_MESSENGER,
    l2Dai.address,
    opts.L2_TX_OPTS,
  ])
  console.log('L2 Gateway: ', l2Gateway.address)
  const l1Gateway = await deployContract<L1Gateway>(opts.l1Deployer, await opts.l1.getContractFactory('L1Gateway'), [
    opts.L1_DAI_ADDRESS,
    l2Gateway.address,
    opts.L1_XDOMAIN_MESSENGER,
    l1Escrow.address,
    opts.L1_TX_OPTS,
  ])
  console.log('L1 Gateway: ', l1Gateway.address)
  await l2Gateway.init(l1Gateway.address, opts.L2_TX_OPTS)

  // Governance deploy
  const l2GovernanceRelay = await deployContract<L2GovernanceRelay>(
    opts.l2Deployer,
    await getL2Factory('L2GovernanceRelay'),
    [opts.L2_XDOMAIN_MESSENGER, opts.L2_TX_OPTS],
  )
  console.log('L2 Governance Relay: ', l2GovernanceRelay.address)
  const l1GovernanceRelay = await deployContract<L1GovernanceRelay>(
    opts.l1Deployer,
    await opts.l1.getContractFactory('L1GovernanceRelay'),
    [l2GovernanceRelay.address, opts.L1_XDOMAIN_MESSENGER, opts.L1_TX_OPTS],
  )
  console.log('L1 Governance Relay: ', l1GovernanceRelay.address)
  await l2GovernanceRelay.init(l1GovernanceRelay.address, opts.L2_TX_OPTS)

  // Permissions
  console.log('Finalizing permissions for L1Escrow...')
  await waitForTx(
    l1Escrow.connect(opts.l1Deployer).approve(opts.L1_DAI_ADDRESS, l1Gateway.address, MAX_UINT256, opts.L1_TX_OPTS),
  )
  await waitForTx(l1Escrow.connect(opts.l1Deployer).rely(opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1Escrow.connect(opts.l1Deployer).rely(opts.L1_ESM_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1Escrow.connect(opts.l1Deployer).deny(await opts.l1Deployer.getAddress(), opts.L1_TX_OPTS))
  console.log('Finalizing permissions for L2 DAI...')
  await waitForTx(l2Dai.rely(l2Gateway.address, opts.L2_TX_OPTS))
  await waitForTx(l2Dai.rely(l2GovernanceRelay.address, opts.L2_TX_OPTS))
  await waitForTx(l2Dai.deny(await opts.l2Deployer.getAddress(), opts.L2_TX_OPTS))
  console.log('Finalizing permissions for L2 Gateway...')
  await waitForTx(l2Gateway.transferOwnership(l2GovernanceRelay.address, opts.L2_TX_OPTS))
  console.log('Finalizing permissions for L1 governance relay...')
  await waitForTx(l1GovernanceRelay.rely(opts.L1_PAUSE_PROXY_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1GovernanceRelay.rely(opts.L1_ESM_ADDRESS, opts.L1_TX_OPTS))
  await waitForTx(l1GovernanceRelay.deny(await opts.l1Deployer.getAddress(), opts.L1_TX_OPTS))

  return {
    l1Escrow,
    l1Gateway,
    l1GovernanceRelay,
    L2Gateway,
    l2Dai,
    l2Gateway,
    l2GovernanceRelay,
  }
}
