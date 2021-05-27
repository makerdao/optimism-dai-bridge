import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-web3'
import '@eth-optimism/hardhat-ovm'
import '@typechain/hardhat'

import { HardhatUserConfig } from 'hardhat/config'

const config: HardhatUserConfig = {
  mocha: {
    timeout: 50000,
  },
  solidity: {
    version: '0.7.6',
    // note: we do not run optimizer
  },
  ovm: {
    solcVersion: '0.7.6',
  },
  networks: {
    hardhat: {
      blockGasLimit: 15000000,
      forking: {
        enabled: process.env.FORKMODE === '1', // this is workaround, only main network can be run in forkmode but we don't need it for most things
        url: 'https://parity-mainnet.makerfoundation.com:8545',
      },
    },
    // workaround to force hardhat to use ovm compiler
    ovm: {
      url: '',
      ovm: true,
    },
    kovan: {
      url: 'https://parity0.kovan.makerfoundation.com:8545',
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_KEY ?? '', // provide via env
  },
}

export default config
