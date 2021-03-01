// fixes ovm instance installed by hardhat by default

const global_dir_1 = require('hardhat/internal/util/global-dir')
const { execSync } = require('child_process')
const { join } = require('path')

async function main() {
  const ovmCompilersCache = join(await global_dir_1.getCompilersDir(), 'ovm')

  const workingSolc = join(__dirname, '../node_modules/@eth-optimism/solc/soljson.js')

  execSync(`mkdir -p ${ovmCompilersCache}`)
  execSync(`rm -rf ${ovmCompilersCache}/0.5.16.js`)
  execSync(`ln -sf ${workingSolc} ${ovmCompilersCache}/0.5.16.js`)
  console.log('Symlinking working ovm done!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
