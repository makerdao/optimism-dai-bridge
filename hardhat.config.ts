import { HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'

import '@eth-optimism/plugins/hardhat/compiler'
import '@eth-optimism/plugins/hardhat/ethers'

const config: HardhatUserConfig = {
  mocha: {
    timeout: 50000,
  },
  solidity: {
    version: '0.5.16',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  ovm: {
    solcVersion: '0.5.16',
  },
  networks: {
    hardhat: {
      blockGasLimit: 15000000,
    },
  },
}

export default config
