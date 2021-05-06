/**
 * Full mainnet deploy including any permissions that need to be set.
 */
import { ethers as l1 } from 'hardhat'
import {
    AuthLike,
    L1GovernanceRelay
  } from '../typechain'
  import {
    deployContract,
  } from '../test-e2e/helpers/utils'

const L1_PAUSE_PROXY_ADDRESS = "0xBE8E3e3618f7474F8cB1d074A26afFef007E98FB"
const L1_ESM_ADDRESS = "0x29CfBd381043D00a98fD9904a431015Fef07af2f"
const L1_DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F"

async function main() {
    // Bridge deploy

    // TODO deploy L1 escrow
    // TODO deploy L2 dai
    // TODO deploy L2 gateway
    // TODO deploy L1 gateway
    // TODO init L2 gateway

    // Governance deploy

    // TODO deploy L2 governance relay
    // TODO deploy L1 governance relay
    // TODO init L2 governance relay

    // Permissions

    // TODO escrow approve() L1 gateway
    // TODO escrow rely() pause proxy
    // TODO escrow rely() esm
    // TODO escrow deny() deployer
    // TODO dai rely() L2 gateway
    // TODO dai rely() L2 governance relay
    // TODO dai deny() deployer
    // TODO gateway transferOwnership() to governance relay
    // TODO l1 gov relay rely() pause proxy
    // TODO l1 gov relay rely() esm
    // TODO l1 gov relay deny() deployer
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error)
        process.exit(1)
    });
