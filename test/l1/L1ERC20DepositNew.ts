import { MockContract, smockit, smoddit } from '@eth-optimism/smock'
import { expect } from 'chai'
import { ContractFactory, Signer } from 'ethers'
import { ethers } from 'hardhat'
import { Dai, Dai__factory, L1ERC20Deposit, L1ERC20Deposit__factory } from '../../typechain'

import { MAX_UINT256, NON_ZERO_ADDRESS, ZERO_ADDRESS } from '../helpers'

const INITIAL_TOTAL_L1_SUPPLY = 3000

const ERR_INVALID_MESSENGER = 'OVM_XCHAIN: messenger contract unauthenticated'
const ERR_INVALID_X_DOMAIN_MSG_SENDER = 'OVM_XCHAIN: wrong sender of cross-domain message'

async function deploy<T extends ContractFactory>(
  name: string,
  args: Parameters<T['deploy']>,
): Promise<ReturnType<T['deploy']>> {
  const factory = (await ethers.getContractFactory(name)) as T
  return factory.deploy(...args)
}

async function deployMock<T extends ContractFactory>(
  name: string,
  opts: {
    provider?: any
    address?: string
  } = {},
): Promise<ReturnType<T['deploy']> & { smocked: any }> {
  const factory = (await ethers.getContractFactory(name)) as T
  return await smockit(factory, opts)
}

describe('L1ERC20Deposit', () => {
  describe('deposit', () => {
    it('escrows funds and sends xchain message on deposit', async () => {
      const [_, escrow, l1MessengerImpersonator, user1] = await ethers.getSigners()
      const depositAmount = 100

      const l2MinterMock = await deployMock('L2ERC20Minter')
      const l1CrossDomainMessengerMock = await deployMock(
        'OVM_L1CrossDomainMessenger',
        { address: await l1MessengerImpersonator.getAddress() }, // This allows us to use an ethers override {from: Mock__OVM_L2CrossDomainMessenger.address} to mock calls
      )
      const l1Dai = await deploy<Dai__factory>('Dai', [])
      const l1Erc20Deposit = await deploy<L1ERC20Deposit__factory>('L1ERC20Deposit', [
        l1Dai.address,
        l2MinterMock.address,
        l1CrossDomainMessengerMock.address,
        await escrow.getAddress(),
      ])
      await l1Dai.mint(user1.address, INITIAL_TOTAL_L1_SUPPLY)

      await l1Dai.connect(user1).approve(l1Erc20Deposit.address, depositAmount)
      await l1Erc20Deposit.connect(user1).deposit(depositAmount)
      const depositCallToMessengerCall = l1CrossDomainMessengerMock.smocked.sendMessage.calls[0]

      expect(await l1Dai.balanceOf(user1.address)).to.be.eq(INITIAL_TOTAL_L1_SUPPLY - depositAmount)
      expect(await l1Dai.balanceOf(l1Erc20Deposit.address)).to.be.eq(0)
      expect(await l1Dai.balanceOf(escrow.address)).to.be.eq(depositAmount)

      expect(depositCallToMessengerCall._target).to.equal(l2MinterMock.address)
      expect(depositCallToMessengerCall._message).to.equal(
        await l2MinterMock.interface.encodeFunctionData('finalizeDeposit', [user1.address, depositAmount]),
      )
    })
  })
})
