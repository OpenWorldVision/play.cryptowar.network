import { random } from 'lodash'
import { toBN } from './common'

function isBlacklist(address: string): boolean {
  if (!address) {
    return false
  }
  const blacklist = [
    '0xd2bd7dba',
    '0x384223e5',
    '0x61c8b5b1',
    '0xd57d22c6',
    '0xeC0B72fF',
    '0xE3567add',
    '0x9fdaa80b',
    '0xb9063c17',
    '0x148B1A20',
    '0x6be37b03',
    '0xA619d31c',
    '0x9a48f254',
    '0xB8B9433c',
    '0x4177ff64',
    '0x25993843',
    '0x6779Fc9E',
    '0x54260f47',
    '0x0dF5e6d6',
    '0x21C6162C',
    '0x3D348420',
    '0x148B1A20',
    '0x428a79Ab',
    '0xE5a141A3',
    '0x04D66B9f',
    '0x428a79Ab',
    '0xb4E9ADB3',
    '0x3e2196e6',
    '0x6779Fc9E',
    '0xd93AB5E5',
    '0x0b9ACcbC',
    '0xE2447893',
    '0xb3b44e83',
  ]
  return blacklist.includes(address.slice(0, 10))
}

export async function calculateFightTax(
  isBlackList: boolean,
  levelHero: number,
  taxByLevelHero: number
) {
  const resultApiBnbPrice: any = await fetch(
    'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd'
  )
    .then((response) => response.json())
    .then((data) => {
      if (!data.binancecoin.usd) {
        return 0
      }
      return Number(data.binancecoin.usd).toFixed(0)
    })
  const weight = isBlackList ? random(18, 25) / 10 : random(20, 55) / 10
  const baseBNBPrice = 369
  const fightGas = 0.0014
  const fightTaxBase = 0.00035

  function getTax(level, marketPrice) {
    const bnbTax = fightGas + fightTaxBase * (1 + (level * 3) / 100)
    const change = marketPrice / baseBNBPrice
    return ((bnbTax / change) * 15) / 10
  }

  function getTaxNeedToSend(level, marketPrice) {
    return (
      Number(
        toBN(getTax(level, marketPrice) * 10 ** 18).multipliedBy(toBN(weight))
      ) -
      fightGas * 10 ** 18
    )
  }
  const fightTaxNeedToSend = Math.max(
    Number(getTaxNeedToSend(levelHero, resultApiBnbPrice).toFixed(0)),
    taxByLevelHero
  )

  return fightTaxNeedToSend.toString()
}
export default isBlacklist
