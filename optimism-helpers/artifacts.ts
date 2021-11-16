import { getContractDefinition } from '@eth-optimism/contracts'

export const artifacts = {
  l1: {
    canonicalTxChain: getContractDefinition('OVM_CanonicalTransactionChain'),
    stateCommitmentChain: getContractDefinition('OVM_StateCommitmentChain'),
    crossDomainMessenger: getContractDefinition('OVM_L1CrossDomainMessenger'),
  },
}
