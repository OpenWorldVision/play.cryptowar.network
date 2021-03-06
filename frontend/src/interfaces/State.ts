import { ICharacter } from './Character'
import { IWeapon } from './Weapon'
import { ITarget } from './Target'
import { Contracts } from './Contracts'
import { Nft } from './Nft'
import { IShield } from './Shield'
import RoomRequest from './RoomRequest'
import { StoreCache } from 'vuex-cache'

export type StakeType = 'lp' | 'lp2'
export const allStakeTypes: StakeType[] = ['lp']

export function isStakeType(stakeType: string): stakeType is StakeType {
  return allStakeTypes.includes(stakeType as StakeType)
}

export interface IWeb3EventSubscription {
  unsubscribe(): void
}

export interface ITransferCooldown {
  secondsLeft: number
  lastUpdatedTimestamp: number
}

export interface IStakeState {
  ownBalance: string
  stakedBalance: string
  remainingCapacityForDeposit: string | null
  remainingCapacityForWithdraw: string
  contractBalance: string
  currentRewardEarned: string
  rewardMinimumStakeTime: number
  rewardDistributionTimeLeft: number
  unlockTimeLeft: number
}

export interface IStakeOverviewState {
  rewardRate: string
  rewardsDuration: number
  totalSupply: string
  minimumStakeTime: number
}

export interface IRaidState {
  expectedFinishTime: string
  raiderCount: number
  bounty: string
  totalPower: string
  weaponDrops: string[]
  staminaDrainSeconds: number

  isOwnedCharacterRaidingById: Record<number, boolean> // ?
}
export interface CareerModeRoom {
  id: number
  characterId: string
  claimed: boolean
  matchReward: string
  owner: string
  totalDeposit: string
  weaponId: string
}
export interface IState {
  contracts: () => Contracts
  eventSubscriptions: () => IWeb3EventSubscription[]
  accounts: string[]
  defaultAccount: string | null
  currentNetworkId: number | null

  fightGasOffset: string
  fightBaseline: string

  skillBalance: string
  skillRewards: string
  maxRewardsClaimTax: string
  rewardsClaimTax: string
  xpRewards: Record<string, string>
  inGameOnlyFunds: string
  directStakeBonusPercent: number
  ownedCharacterIds: number[]
  ownedWeaponIds: number[]
  ownedCommonBoxIds: number[]
  ownedShieldIds: number[]
  maxStamina: number
  ownedDust: string[]

  currentCharacterId: number | null
  characters: Record<number, ICharacter>
  characterStaminas: Record<number, number>
  secondPerCharacter: Record<number, number>
  characterRenames: Record<number, string>

  currentWeaponId: number | null
  weapons: Record<number, IWeapon>
  weaponDurabilities: Record<number, number>
  weaponRenames: Record<number, string>
  maxDurability: number
  targetsByCharacterIdAndWeaponId: Record<number, Record<number, ITarget>>

  currentNftType: string | null
  currentNftId: number | null

  characterTransferCooldowns: Record<number, ITransferCooldown | undefined>

  staking: Record<StakeType, IStakeState>
  stakeOverviews: Record<StakeType, IStakeOverviewState>

  raid: IRaidState

  waxBridgeWithdrawableBnb: string
  waxBridgeRemainingWithdrawableBnbDuringPeriod: string
  waxBridgeTimeUntilLimitExpires: number

  isInCombat: boolean
  isCharacterViewExpanded: boolean

  shields: Record<number, IShield>
  currentShieldId: number | null

  nfts: Record<string, Record<number | string, Nft>>

  commonBoxPrice: string
  rareBoxPrice: string
  epicBoxPrice: string
  secondsPerStamina: number
  careerModeRooms: CareerModeRoom[]
  careerModeRequest: RoomRequest[]
  rewardPvp: number
  myCareerModeRequest: RoomRequest[]
  myXgem: number | string
  commonBoxPriceXgem: number | string
  rareBoxPriceXgem: number | string
  epicBoxPriceXgem: number | string
  blindBoxPriceXgem: number | string
  cache?: StoreCache
  myCareerModeRoom: CareerModeRoom[]
}
