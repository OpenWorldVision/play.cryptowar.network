/* eslint-disable @typescript-eslint/no-unused-vars */
import { abi as erc20Abi } from '../../build/contracts/IERC20.json'

import { networks as lpTokenNetworks } from '../../build/contracts/ExperimentToken.json'
import { abi as stakingRewardsAbi } from '../../build/contracts/IStakingRewards.json'

import {
  abi as cryptoWarsAbi,
  networks as cryptoWarsNetworks,
} from '../../build/contracts/CryptoWars.json'
import {
  abi as raidAbi,
  networks as raidNetworks,
} from '../../build/contracts/RaidBasic.json'
import { abi as charactersAbi } from '../../build/contracts/Characters.json'
import { abi as weaponsAbi } from '../../build/contracts/Weapons.json'
import { abi as blacksmithAbi } from '../../build/contracts/Blacksmith.json'
import { abi as shieldsAbi } from '../../build/contracts/Shields.json'
import { abi as randomsAbi } from '../../build/contracts/IRandoms.json'
import {
  abi as marketAbi,
  networks as marketNetworks,
} from '../../build/contracts/NFTMarket.json'
import {
  abi as xBladeTokenAbi,
  networks as xBladeTokenNetworks,
} from '../../build/contracts/xBlade.json'
import { abi as secretBoxAbi } from '../../build/contracts/SecretBox.json'
import { abi as cwControllerAbi } from '../../build/contracts/CWController.json'
import { abi as careerModeAbi } from '../../build/contracts/CareerMode.json'
import { abi as blindBoxAbi } from '../../build/contracts/BlindBox.json'
import Web3 from 'web3'
import {
  Contracts,
  isStakeType,
  StakeType,
  StakingContracts,
} from './interfaces'

import { StakingContractEntry, stakingContractsInfo } from './stake-types'

import {
  raid as featureFlagRaid,
  stakeOnly as featureFlagStakeOnly,
  market as featureFlagMarket,
} from './feature-flags'

import { getAddressesAuto } from './addresses'

interface RaidContracts {
  RaidBasic?: Contracts['RaidBasic']
}

interface MarketContracts {
  NFTMarket?: Contracts['NFTMarket']
}

type Networks = Partial<Record<string, { address: string }>>

type Abi = any[]

const stakingContractAddressesFromBuild: Partial<
  Record<StakeType, Partial<StakingContractEntry>>
> = {
  // skill: {
  //   stakingRewardsAddress: (xBladeStakingRewardsNetworks as Networks)[networkId]?.address,
  //   stakingTokenAddress: (xBladeTokenNetworks as Networks)[networkId]?.address
  // },
  // lp: {
  //   stakingRewardsAddress: (lpStakingRewardsNetworks as Networks)[networkId]?.address,
  //   stakingTokenAddress: (lpTokenNetworks as Networks)[networkId]?.address
  // },
  // lp2: {
  //   stakingRewardsAddress: (lp2StakingRewardsNetworks as Networks)[networkId]?.address,
  //   stakingTokenAddress: (lp2TokenNetworks as Networks)[networkId]?.address
  // }
}

async function getStakingContractsInfoWithDefaults() {
  const out: Partial<Record<StakeType, Partial<StakingContractEntry>>> = {}

  for (const stakeType of Object.keys(await stakingContractsInfo).filter(
    isStakeType
  )) {
    const stakingContractInfo = (await stakingContractsInfo)[stakeType]!
    if (
      stakingContractInfo.stakingRewardsAddress &&
      stakingContractInfo.stakingTokenAddress
    ) {
      out[stakeType] = {
        stakingRewardsAddress: stakingContractInfo.stakingRewardsAddress,
        stakingTokenAddress: stakingContractInfo.stakingTokenAddress,
      }
    } else {
      out[stakeType] = Object.assign(
        {},
        stakingContractInfo,
        stakingContractAddressesFromBuild[stakeType]
      )
    }
  }

  return out
}

async function setUpStakingContracts(web3: Web3) {
  const stakingContractsInfo = await getStakingContractsInfoWithDefaults()

  const staking: StakingContracts = {}

  const expectedNetwork = await getAddressesAuto()
  const networkId = expectedNetwork.VUE_APP_NETWORK_ID || '5777'

  for (const stakeType of Object.keys(stakingContractsInfo).filter(
    isStakeType
  )) {
    const stakingContractInfo = stakingContractsInfo[stakeType]!

    if (
      !stakingContractInfo.stakingRewardsAddress ||
      !stakingContractInfo.stakingTokenAddress
    )
      continue

    staking[stakeType] = {
      StakingRewards: new web3.eth.Contract(
        stakingRewardsAbi as Abi,
        stakingContractInfo.stakingRewardsAddress
      ),
      StakingToken: new web3.eth.Contract(
        erc20Abi as Abi,
        stakingContractInfo.stakingTokenAddress
      ),
    }
  }
  const xBladeTokenAddress =
    expectedNetwork.VUE_APP_XBLADE_TOKEN_CONTRACT_ADDRESS ||
    (xBladeTokenNetworks as Networks)[networkId]!.address
  const xBladeToken = new web3.eth.Contract(erc20Abi as Abi, xBladeTokenAddress)

  return {
    xBladeToken,

    staking,
  }
}

export async function setUpContracts(web3: Web3): Promise<Contracts> {
  const expectedNetwork = await getAddressesAuto()
  const networkId = expectedNetwork.VUE_APP_NETWORK_ID || '5777'
  const cryptoBladesContractAddr =
    expectedNetwork.VUE_APP_CRYPTOWARS_CONTRACT_ADDRESS ||
    (cryptoWarsNetworks as Networks)[networkId]!.address

  const CryptoWars = new web3.eth.Contract(
    cryptoWarsAbi as Abi,
    cryptoBladesContractAddr
  )
  const [charactersAddr, weaponsAddr, randomsAddr, blacksmithAddr] =
    await Promise.all([
      CryptoWars.methods.characters().call(),
      CryptoWars.methods.weapons().call(),
      CryptoWars.methods.randoms().call(),
      CryptoWars.methods.blacksmith().call(),
    ])
  const Randoms = new web3.eth.Contract(randomsAbi as Abi, randomsAddr)
  const Characters = new web3.eth.Contract(charactersAbi as Abi, charactersAddr)
  const Weapons = new web3.eth.Contract(weaponsAbi as Abi, weaponsAddr)
  const Blacksmith = new web3.eth.Contract(blacksmithAbi as Abi, blacksmithAddr)
  const SecretBox = new web3.eth.Contract(
    secretBoxAbi as Abi,
    expectedNetwork.VUE_APP_SECRET_BOX_ADDRESS
  )
  const CWController = new web3.eth.Contract(
    cwControllerAbi as Abi,
    expectedNetwork.VUE_APP_CW_CONTROLLER_ADDRESS
  )
  const CareerMode = new web3.eth.Contract(
    careerModeAbi as Abi,
    expectedNetwork.VUE_APP_CAREER_MODE_ADDRESS
  )
  const BlindBox = new web3.eth.Contract(
    blindBoxAbi as Abi,
    expectedNetwork.VUE_APP_BLIND_BOX
  )

  const xBladeTokenAddress =
    expectedNetwork.VUE_APP_XBLADE_TOKEN_CONTRACT_ADDRESS
  const xBladeToken = new web3.eth.Contract(
    xBladeTokenAbi as Abi,
    xBladeTokenAddress
  )

  const shieldsAddr = await Blacksmith.methods.shields().call()
  const Shields = new web3.eth.Contract(shieldsAbi as Abi, shieldsAddr)

  const raidContracts: RaidContracts = {}
  if (featureFlagRaid) {
    const raidContractAddr =
      expectedNetwork.VUE_APP_RAID_CONTRACT_ADDRESS ||
      (raidNetworks as Networks)[networkId]!.address

    raidContracts.RaidBasic = new web3.eth.Contract(
      raidAbi as Abi,
      raidContractAddr
    )
  }

  const marketContracts: MarketContracts = {}
  if (featureFlagMarket) {
    const marketContractAddr =
      expectedNetwork.VUE_APP_MARKET_CONTRACT_ADDRESS ||
      (marketNetworks as Networks)[networkId]!.address

    marketContracts.NFTMarket = new web3.eth.Contract(
      marketAbi as Abi,
      marketContractAddr
    )
  }

  return {
    CryptoWars,
    Randoms,
    Characters,
    Weapons,
    Blacksmith,
    Shields,
    CWController,
    ...raidContracts,
    ...marketContracts,
    xBladeToken,
    SecretBox,
    CareerMode,
    BlindBox,
  }
}

export const INTERFACE_ID_TRANSFER_COOLDOWNABLE = '0xe62e6974'
