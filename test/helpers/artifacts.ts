import { readFileSync } from 'fs'
import { join } from 'path'

export const artifacts = {
  l1: {
    token: require('../../artifacts/contracts/ERC20.sol/ERC20.json'),
    tokenDeposit: require('../../artifacts/contracts/L1ERC20Deposit.sol/L1ERC20Deposit.json'),
    canonicalTxChain: require('../../../contracts-v2/build/artifacts/OVM_CanonicalTransactionChain.json'),
    stateCommitmentChain: require('../../../contracts-v2/build/artifacts/OVM_StateCommitmentChain.json'),
  },
  l2: {
    dai: {
      abi: JSON.parse(readFileSync(join(__dirname, '../../artifacts-l2/__contracts-l2_dss_dai_sol_Dai.abi'), 'utf-8')),
      bytecode: readFileSync(join(__dirname, '../../artifacts-l2/__contracts-l2_dss_dai_sol_Dai.bin'), 'utf-8'),
    },
    minter: {
      abi: JSON.parse(
        readFileSync(join(__dirname, '../../artifacts-l2/__contracts-l2_L2ERC20Minter_sol_L2ERC20Minter.abi'), 'utf-8'),
      ),
      bytecode: readFileSync(
        join(__dirname, '../../artifacts-l2/__contracts-l2_L2ERC20Minter_sol_L2ERC20Minter.bin'),
        'utf-8',
      ),
    },
  },
}
