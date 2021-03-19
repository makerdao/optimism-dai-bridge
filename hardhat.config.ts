import { HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-web3'

import '@eth-optimism/plugins/hardhat/compiler'
import '@eth-optimism/plugins/hardhat/ethers'
import '@eth-optimism/smock/build/src/plugins/hardhat-storagelayout'

import '@typechain/hardhat'

const config: HardhatUserConfig = {
  mocha: {
    timeout: 50000,
  },
  solidity: {
    version: '0.7.6',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  ovm: {
    solcVersion: '0.7.6',
  },
  networks: {
    hardhat: {
      blockGasLimit: 15000000,
    },
  },
}

export default config
