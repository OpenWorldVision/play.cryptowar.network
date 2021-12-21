import Vue from 'vue';
import Vuex from 'vuex';
import Web3 from 'web3';
import _, { isUndefined } from 'lodash';
import { toBN, bnMinimum, gasUsedToBnb } from './utils/common';

import {
  INTERFACE_ID_TRANSFER_COOLDOWNABLE,
  setUpContracts
} from './contracts';
import {
  characterFromContract,
  targetFromContract,
  weaponFromContract,
  shieldFromContract
} from './contract-models';
import {
  CareerModeRoom,
  Contract,
  Contracts,
  isStakeType,
  IStakeOverviewState,
  IStakeState,
  IState,
  ITransferCooldown,
  IWeb3EventSubscription,
  StakeType
} from './interfaces';
import { getCharacterNameFromSeed } from './character-name';
import {  getFeeInSkillFromUsd } from './contract-call-utils';

import {
  raid as featureFlagRaid,
  stakeOnly as featureFlagStakeOnly,
  reforging as featureFlagReforging
} from './feature-flags';
import { IERC721, IStakingRewards, IERC20 } from '../../build/abi-interfaces';
import { stakeTypeThatCanHaveUnclaimedRewardsStakedTo } from './stake-types';
import { Nft } from './interfaces/Nft';
import { getWeaponNameFromSeed } from '@/weapon-name';
import isBlacklist from './utils/blacklist';
import RoomRequest from './interfaces/RoomRequest';

const defaultCallOptions = (state: IState) => ({ from: state.defaultAccount });

interface SetEventSubscriptionsPayload {
  eventSubscriptions: () => IWeb3EventSubscription[];
}

type StakingRewardsAlias = Contract<IStakingRewards> | null;

interface StakingContracts {
  StakingRewards: StakingRewardsAlias;
  StakingToken: Contract<IERC20> | null;
  RewardToken: Contracts['xBladeToken'];
}

function getStakingContracts(
  contracts: Contracts,
  stakeType: StakeType
): StakingContracts {
  return {
    StakingRewards: contracts.staking[stakeType]?.StakingRewards || null,
    StakingToken: contracts.staking[stakeType]?.StakingToken || null,
    RewardToken: contracts.xBladeToken
  };
}

interface RaidData {
  expectedFinishTime: string;
  raiderCount: number;
  bounty: string;
  totalPower: string;
  weaponDrops: string[];
  staminaDrainSeconds: number;
}

type WaxBridgeDetailsPayload = Pick<
IState,
| 'waxBridgeWithdrawableBnb'
| 'waxBridgeRemainingWithdrawableBnbDuringPeriod'
| 'waxBridgeTimeUntilLimitExpires'
>;

const defaultStakeState: IStakeState = {
  ownBalance: '0',
  stakedBalance: '0',
  remainingCapacityForDeposit: '0',
  remainingCapacityForWithdraw: '0',
  contractBalance: '0',
  currentRewardEarned: '0',
  rewardMinimumStakeTime: 0,
  rewardDistributionTimeLeft: 0,
  unlockTimeLeft: 0
};

const defaultStakeOverviewState: IStakeOverviewState = {
  rewardRate: '0',
  rewardsDuration: 0,
  totalSupply: '0',
  minimumStakeTime: 0
};

export function createStore(web3: Web3) {
  return new Vuex.Store<IState>({
    state: {
      contracts: null!,
      eventSubscriptions: () => [],

      accounts: [],
      defaultAccount: null,
      currentNetworkId: null,

      fightGasOffset: '0',
      fightBaseline: '0',

      skillBalance: '0',
      skillRewards: '0',
      maxRewardsClaimTax: '0',
      rewardsClaimTax: '0',
      xpRewards: {},
      inGameOnlyFunds: '0',
      directStakeBonusPercent: 10,
      ownedCharacterIds: [],
      ownedWeaponIds: [],
      ownedShieldIds: [],
      maxStamina: 0,
      currentCharacterId: null,
      ownedDust: [],

      characters: {},
      rewardPvp: 0,
      characterStaminas: {},
      secondPerCharacter:{},
      characterRenames: {},
      weapons: {},
      currentWeaponId: null,
      currentNftType: null,
      currentNftId: null,
      weaponDurabilities: {},
      weaponRenames: {},
      maxDurability: 0,
      isInCombat: false,
      isCharacterViewExpanded: localStorage.getItem('isCharacterViewExpanded')
        ? localStorage.getItem('isCharacterViewExpanded') === 'true'
        : true,

      targetsByCharacterIdAndWeaponId: {},

      characterTransferCooldowns: {},

      shields: {},
      currentShieldId: null,
      nfts: {},

      staking: {
        // skill: { ...defaultStakeState },
        // skill2: { ...defaultStakeState },
        lp: { ...defaultStakeState },
        lp2: { ...defaultStakeState }
      },
      stakeOverviews: {
        lp: { ...defaultStakeOverviewState },
        lp2: { ...defaultStakeOverviewState }
      },

      raid: {
        expectedFinishTime: '0',
        raiderCount: 0,
        bounty: '0',
        totalPower: '0',
        weaponDrops: [],
        staminaDrainSeconds: 0,
        isOwnedCharacterRaidingById: {}
      },

      waxBridgeWithdrawableBnb: '0',
      waxBridgeRemainingWithdrawableBnbDuringPeriod: '0',
      waxBridgeTimeUntilLimitExpires: 0,
      commonBoxPrice: web3.utils.toWei('0', 'ether'),
      rareBoxPrice: web3.utils.toWei('0', 'ether'),
      secondsPerStamina: 1,
      careerModeRooms: [],
      careerModeRequest: [],
      myCareerModeRequest: []
    },

    getters: {
      contracts(state: IState) {
        // our root component prevents the app from being active if contracts
        // are not set up, so we never need to worry about it being null anywhere else
        return _.isFunction(state.contracts) ? state.contracts() : null!;
      },

      availableStakeTypes(state: IState) {
        return Object.keys(state.contracts().staking).filter(isStakeType);
      },

      hasStakedBalance(state) {
        if (!state.contracts) return false;

        const staking = state.contracts().staking;
        for (const stakeType of Object.keys(staking).filter(isStakeType)) {
          if (state.staking[stakeType].stakedBalance !== '0') {
            return true;
          }
        }
        return false;
      },

      getTargetsByCharacterIdAndWeaponId(state: IState) {
        return (characterId: number, weaponId: number) => {
          const targetsByWeaponId =
            state.targetsByCharacterIdAndWeaponId[characterId];
          if (!targetsByWeaponId) return [];

          return targetsByWeaponId[weaponId] ?? [];
        };
      },

      getCharacterName(state: IState) {
        return (characterId: number) => {
          if (state.characterRenames[characterId] !== undefined) {
            return state.characterRenames[characterId];
          }
          return getCharacterNameFromSeed(characterId);
        };
      },

      getCharacterStamina(state: IState) {
        return (characterId: number) => {
          return state.characterStaminas[characterId];
        };
      },
      getSecondPerStamina(state: IState) {
        return (characterId: number) => {
          return (state.secondPerCharacter[characterId] / 60).toFixed(2);
        };
      },

      getCharacterRename(state: IState) {
        return (characterId: number) => {
          return state.characterRenames[characterId];
        };
      },

      getCharacterUnclaimedXp(state: IState) {
        return (characterId: number) => {
          return state.xpRewards[characterId];
        };
      },

      getWeaponDurability(state: IState) {
        return (weaponId: number) => {
          return state.weaponDurabilities[weaponId];
        };
      },
      getWeaponRename(state: IState) {
        return (weaponId: number) => {
          return state.weaponRenames[weaponId];
        };
      },
      getWeaponName(state: IState) {
        return (weaponId: number, stars: number) => {
          if (state.weaponRenames[weaponId] !== undefined) {
            return state.weaponRenames[weaponId];
          }

          return getWeaponNameFromSeed(weaponId, stars);
        };
      },
      getExchangeUrl() {
        return process.env.VUE_APP_EXCHANGE_URL || 'https://pancake.kiemtienonline360.com/#/swap?outputCurrency=0x27a339d9B59b21390d7209b78a839868E319301B';
      },

      ownCharacters(state, getters) {
        return getters.charactersWithIds(state.ownedCharacterIds);
      },

      charactersWithIds(state) {
        return (characterIds: (string | number)[]) => {
          const characters = characterIds.map(id => state.characters[+id]);
          if (characters.some(w => w === null)) return [];
          return characters.filter(Boolean);
        };
      },

      getPowerfulDust(state) {
        return () => {
          const dust = state.ownedDust[2];
          return dust;
        };
      },

      getLesserDust(state) {
        return () => {
          const dust = state.ownedDust[0];
          return dust;
        };
      },

      getGreaterDust(state) {
        return () => {
          const dust = state.ownedDust[1];
          return dust;
        };
      },

      getBoxPrice(state) {
        return () => ({
          common: state.commonBoxPrice,
          rare: state.rareBoxPrice
        });
      },

      ownWeapons(state, getters) {
        return getters.weaponsWithIds(state.ownedWeaponIds);
      },

      weaponsWithIds(state) {
        return (weaponIds: (string | number)[]) => {
          const weapons = weaponIds.map(id => state.weapons[+id]);
          if (weapons.some(w => w === null)) return [];
          return weapons;
        };
      },

      shieldsWithIds(state) {
        return (shieldIds: (string | number)[]) => {
          const shields = shieldIds.map(id => {
            const shieldNft = state.shields[+id] as Nft;
            if (!shieldNft) {
              return;
            }
            shieldNft.type = 'shield';
            return shieldNft;
          });
          if (shields.some(s => s === null)) return [];
          return shields;
        };
      },

      nftsCount(state) {
        let count = 0;
        // add count of various nft types here
        count += state.ownedShieldIds.length;
        return count;
      },

      nftsWithIdType(state) {
        return (nftIdTypes: { type: string; id: string | number }[]) => {
          const nfts = nftIdTypes.map(idType => {
            const nft =
              state.nfts[idType.type] && state.nfts[idType.type][+idType.id];
            if (!nft) {
              return;
            }
            nft.type = idType.type;
            nft.id = idType.id;
            return nft;
          });

          if (nfts.some(t => t === null)) return [];
          return nfts;
        };
      },

      currentWeapon(state) {
        if (state.currentWeaponId === null) return null;

        return state.weapons[state.currentWeaponId];
      },

      transferCooldownOfCharacterId(state) {
        return (characterId: string | number, now: number | null = null) => {
          const transferCooldown =
            state.characterTransferCooldowns[+characterId];
          if (!transferCooldown) return 0;

          const deltaFromLastUpdated =
            now === null ? 0 : now - transferCooldown.lastUpdatedTimestamp;

          return Math.max(
            Math.floor(transferCooldown.secondsLeft - deltaFromLastUpdated),
            0
          );
        };
      },

      currentCharacter(state) {
        if (state.currentCharacterId === null) return null;

        return state.characters[state.currentCharacterId];
      },

      currentCharacterStamina(state) {
        return state.currentCharacterId === null
          ? 0
          : state.characterStaminas[state.currentCharacterId];
      },

      timeUntilCurrentCharacterHasMaxStamina(state, getters) {
        return getters.timeUntilCharacterHasMaxStamina(
          state.currentCharacterId
        );
      },

      timeUntilCharacterHasMaxStamina(state, getters) {
        return (id: number) => {
          const currentStamina = getters.getCharacterStamina(id);

          if (!currentStamina && currentStamina !== 0) {
            return '';
          }

          const date = new Date();

          if (state.maxStamina !== currentStamina) {
            date.setTime(
              date.getTime() + (state.maxStamina - currentStamina) * (5 * 60000)
            );
          }

          return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date
            .getDate()
            .toString()
            .padStart(2, '0')}/${date
            .getFullYear()
            .toString()
            .padStart(4, '0')} ${date
            .getHours()
            .toString()
            .padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}:${date
            .getSeconds()
            .toString()
            .padStart(2, '0')}`;
        };
      },

      timeUntilWeaponHasMaxDurability(state, getters) {
        return (id: number) => {
          const currentDurability = getters.getWeaponDurability(id);
          if (currentDurability === null || currentDurability === undefined) {
            return '';
          }
          const date = new Date();

          if (state.maxDurability !== currentDurability) {
            date.setTime(
              date.getTime() +
                (state.maxDurability - currentDurability) * (50 * 60000)
            );
          }

          return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date
            .getDate()
            .toString()
            .padStart(2, '0')}/${date
            .getFullYear()
            .toString()
            .padStart(4, '0')} ${date
            .getHours()
            .toString()
            .padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}:${date
            .getSeconds()
            .toString()
            .padStart(2, '0')}`;
        };
      },

      allStaminas(state) {
        return state.characterStaminas;
      },

      maxRewardsClaimTaxAsFactorBN(state) {
        return toBN(state.maxRewardsClaimTax).dividedBy(
          toBN(2).exponentiatedBy(64)
        );
      },

      rewardsClaimTaxAsFactorBN(state) {
        return toBN(state.rewardsClaimTax).dividedBy(
          toBN(2).exponentiatedBy(64)
        );
      },

      stakeState(state) {
        return (stakeType: StakeType): IStakeState => state.staking[stakeType];
      },

      isOwnedCharacterRaiding(state) {
        if (!featureFlagRaid) return false;

        return (characterId: number): boolean =>
          state.raid.isOwnedCharacterRaidingById[characterId] || false;
      },

      fightGasOffset(state) {
        return state.fightGasOffset;
      },

      fightBaseline(state) {
        return state.fightBaseline;
      },

      getIsInCombat(state: IState): boolean {
        return state.isInCombat;
      },

      getIsCharacterViewExpanded(state: IState): boolean {
        return state.isCharacterViewExpanded;
      },
      minutesPerStamina(state: IState): string {
        return (state.secondsPerStamina / 60).toFixed(2);
      },

      waxBridgeAmountOfBnbThatCanBeWithdrawnDuringPeriod(state): string {
        return bnMinimum(
          state.waxBridgeWithdrawableBnb,
          state.waxBridgeRemainingWithdrawableBnbDuringPeriod
        ).toString();
      }
    },

    mutations: {
      setNetworkId(state, payload) {
        state.currentNetworkId = payload;
      },

      setAccounts(state: IState, payload) {
        state.accounts = payload.accounts;

        if (payload.accounts.length > 0) {
          state.defaultAccount = payload.accounts[0];
        } else {
          state.defaultAccount = null;
        }
      },

      setContracts(state: IState, payload) {
        state.contracts = payload;
      },

      setEventSubscriptions(
        state: IState,
        payload: SetEventSubscriptionsPayload
      ) {
        state.eventSubscriptions = payload.eventSubscriptions;
      },

      updateSkillBalance(state: IState, { skillBalance }) {
        state.skillBalance = skillBalance;
      },

      updateDustBalance(state: IState, { dustBalance }) {
        state.ownedDust = dustBalance;
      },

      updateSkillRewards(
        state: IState,
        { skillRewards }: { skillRewards: string }
      ) {
        state.skillRewards = skillRewards;
      },

      updateRewardsClaimTax(
        state,
        {
          maxRewardsClaimTax,
          rewardsClaimTax
        }: { maxRewardsClaimTax: string; rewardsClaimTax: string }
      ) {
        state.maxRewardsClaimTax = maxRewardsClaimTax;
        state.rewardsClaimTax = rewardsClaimTax;
      },

      updateXpRewards(
        state: IState,
        { xpRewards }: { xpRewards: { [characterId: string]: string } }
      ) {
        for (const charaId in xpRewards) {
          Vue.set(state.xpRewards, charaId, xpRewards[charaId]);
        }
      },

      updateInGameOnlyFunds(
        state,
        { inGameOnlyFunds }: Pick<IState, 'inGameOnlyFunds'>
      ) {
        state.inGameOnlyFunds = inGameOnlyFunds;
      },

      updateFightGasOffset(
        state: IState,
        { fightGasOffset }: { fightGasOffset: string }
      ) {
        state.fightGasOffset = fightGasOffset;
      },

      updateFightBaseline(
        state: IState,
        { fightBaseline }: { fightBaseline: string }
      ) {
        state.fightBaseline = fightBaseline;
      },

      updateUserDetails(state: IState, payload) {
        const keysToAllow = [
          'ownedCharacterIds',
          'ownedWeaponIds',
          'maxStamina',
          'maxDurability',
          'ownedShieldIds'
        ];
        for (const key of keysToAllow) {
          if (Object.hasOwnProperty.call(payload, key)) {
            Vue.set(state, key, payload[key]);
          }
        }

        if (
          state.ownedCharacterIds.length > 0 &&
          (!state.currentCharacterId ||
            !state.ownedCharacterIds.includes(state.currentCharacterId))
        ) {
          state.currentCharacterId = state.ownedCharacterIds[0];
        } else if (state.ownedCharacterIds.length === 0) {
          state.currentCharacterId = null;
        }
      },

      setCurrentCharacter(state: IState, characterId: number) {
        state.currentCharacterId = characterId;
      },

      setIsInCombat(state: IState, isInCombat: boolean) {
        state.isInCombat = isInCombat;
      },

      setIsCharacterViewExpanded(state: IState, isExpanded: boolean) {
        state.isCharacterViewExpanded = isExpanded;
        localStorage.setItem(
          'isCharacterViewExpanded',
          isExpanded ? 'true' : 'false'
        );
      },

      addNewOwnedCharacterId(state: IState, characterId: number) {
        if (!state.ownedCharacterIds.includes(characterId)) {
          state.ownedCharacterIds.push(characterId);
        }
      },

      addNewOwnedWeaponId(state: IState, weaponId: number) {
        if (!state.ownedWeaponIds.includes(weaponId)) {
          state.ownedWeaponIds.push(weaponId);
        }
      },

      addNewOwnedShieldId(state: IState, shieldId: number) {
        if (!state.ownedShieldIds.includes(shieldId)) {
          state.ownedShieldIds.push(shieldId);
        }
      },

      updateCharacter(state: IState, { characterId, character }) {
        Vue.set(state.characters, characterId, character);
      },

      updateCharacterTransferCooldown(
        state: IState,
        {
          characterId,
          characterTransferCooldown
        }: { characterId: number; characterTransferCooldown: ITransferCooldown }
      ) {
        Vue.set(
          state.characterTransferCooldowns,
          characterId,
          characterTransferCooldown
        );
      },

      updateShield(state: IState, { shieldId, shield }) {
        Vue.set(state.shields, shieldId, shield);
        if (!state.nfts.shield) {
          Vue.set(state.nfts, 'shield', {});
        }
        Vue.set(state.nfts.shield, shieldId, shield);
      },

      updateWeapon(state: IState, { weaponId, weapon }) {
        Vue.set(state.weapons, weaponId, weapon);
      },

      setCurrentWeapon(state: IState, weaponId: number) {
        state.currentWeaponId = weaponId;
      },

      updateWeaponDurability(state: IState, { weaponId, durability }) {
        Vue.set(state.weaponDurabilities, weaponId, durability);
      },
      updateWeaponRename(state: IState, { weaponId, renameString }) {
        console.log('rename for ' + weaponId + ' is ' + renameString);
        if (renameString !== undefined) {
          Vue.set(state.weaponRenames, weaponId, renameString);
        }
      },
      updateCharacterStamina(state: IState, { characterId, stamina }) {
        Vue.set(state.characterStaminas, characterId, stamina);
      },
      updateSecondPerStamina(state: IState, {characterId, stamina}){
        Vue.set(state.secondPerCharacter, characterId, stamina);
      },
      updateCharacterRename(state: IState, { characterId, renameString }) {
        if (renameString !== undefined) {
          Vue.set(state.characterRenames, characterId, renameString);
        }
      },
      updateTargets(state: IState, { characterId, weaponId, targets }) {
        if (!state.targetsByCharacterIdAndWeaponId[characterId]) {
          Vue.set(state.targetsByCharacterIdAndWeaponId, characterId, {});
        }

        Vue.set(
          state.targetsByCharacterIdAndWeaponId[characterId],
          weaponId,
          targets
        );
      },

      updateStakeData(
        state: IState,
        { stakeType, ...payload }: { stakeType: StakeType } & IStakeState
      ) {
        Vue.set(state.staking, stakeType, payload);
      },

      updateStakeOverviewDataPartial(
        state,
        payload: { stakeType: StakeType } & IStakeOverviewState
      ) {
        const { stakeType, ...data } = payload;
        Vue.set(state.stakeOverviews, stakeType, data);
      },

      updateRaidData(state, payload: RaidData) {
        state.raid.expectedFinishTime = payload.expectedFinishTime;
        state.raid.raiderCount = payload.raiderCount;
        state.raid.bounty = payload.bounty;
        state.raid.totalPower = payload.totalPower;
        state.raid.weaponDrops = payload.weaponDrops;
        state.raid.staminaDrainSeconds = payload.staminaDrainSeconds;
      },

      updateAllIsOwnedCharacterRaidingById(
        state,
        payload: Record<number, boolean>
      ) {
        state.raid.isOwnedCharacterRaidingById = payload;
      },

      updateWaxBridgeDetails(state, payload: WaxBridgeDetailsPayload) {
        state.waxBridgeWithdrawableBnb = payload.waxBridgeWithdrawableBnb;
        state.waxBridgeRemainingWithdrawableBnbDuringPeriod =
          payload.waxBridgeRemainingWithdrawableBnbDuringPeriod;
        state.waxBridgeTimeUntilLimitExpires =
          payload.waxBridgeTimeUntilLimitExpires;
      },

      setCurrentNft(state: IState, payload: { type: string; id: number }) {
        state.currentNftType = payload.type;
        state.currentNftId = payload.id;
      },

      updateBoxPrice(state: IState, payload: {commonPrice: string, rarePrice: string}) {
        state.commonBoxPrice = payload.commonPrice;
        state.rareBoxPrice = payload.rarePrice;
      },

      updateSecondsPerStamina(state: IState, payload: {secondsPerStamina: number}){
        state.secondsPerStamina = payload.secondsPerStamina;
      },

      updateCareerRoom(state: IState, payload: { rooms: CareerModeRoom[] }){
        state.careerModeRooms = payload.rooms;
      },

      updateCareerModeRequest(state: IState, payload: { requests: RoomRequest[] }){
        state.careerModeRequest = payload.requests;
      },
      updateRewardPvp(state: IState, payload: {reward: number}){
        state.rewardPvp = payload.reward;
      },
      updateMyCareerModeRequest(state: IState, payload: {request: RoomRequest[]}) {
        state.myCareerModeRequest = payload.request;
      }
    },

    actions: {
      async initialize({ dispatch }) {
        await dispatch('setUpContracts');
        await dispatch('setUpContractEvents');

        await dispatch('pollAccountsAndNetwork');

        await dispatch('setupCharacterStaminas');
        await dispatch('setupCharacterRenames');
        await dispatch('setupWeaponDurabilities');
        await dispatch('setupWeaponRenames');
      },

      async pollAccountsAndNetwork({ state, dispatch, commit }) {
        let refreshUserDetails = false;
        const networkId = await web3.eth.net.getId();

        if (state.currentNetworkId !== networkId) {
          commit('setNetworkId', networkId);
          refreshUserDetails = true;
        }

        const accounts = await web3.eth.requestAccounts();

        if (!_.isEqual(state.accounts, accounts)) {
          commit('setAccounts', { accounts });
          refreshUserDetails = true;
        }

        if (refreshUserDetails) {
          await Promise.all([
            dispatch('setUpContractEvents'),
            dispatch('fetchUserDetails')
          ]);
        }
      },

      setUpContractEvents({ state, dispatch, commit }) {
        state.eventSubscriptions().forEach(sub => sub.unsubscribe());

        const emptySubsPayload: SetEventSubscriptionsPayload = {
          eventSubscriptions: () => []
        };
        commit('setEventSubscriptions', emptySubsPayload);

        if (!state.defaultAccount) return;

        const subscriptions: IWeb3EventSubscription[] = [];

        if (!featureFlagStakeOnly) {
          subscriptions.push(
            state
              .contracts()
              .Characters!.events.NewCharacter(
              { filter: { minter: state.defaultAccount } },
              async (err: Error, data: any) => {
                if (err) {
                  console.error(err, data);
                  return;
                }

                const characterId = data.returnValues.character;

                commit('addNewOwnedCharacterId', characterId);

                await Promise.all([
                  dispatch('fetchCharacter', characterId),
                  dispatch('fetchSkillBalance'),
                  dispatch('fetchFightRewardSkill'),
                  dispatch('fetchFightRewardXp'),
                  dispatch('fetchDustBalance')
                ]);
              }
            )
          );

          subscriptions.push(
            state
              .contracts()
              .Weapons!.events.NewWeapon(
              { filter: { minter: state.defaultAccount } },
              async (err: Error, data: any) => {
                if (err) {
                  console.error(err, data);
                  return;
                }

                const weaponId = data.returnValues.weapon;

                commit('addNewOwnedWeaponId', weaponId);

                await Promise.all([
                  dispatch('fetchWeapon', weaponId),
                  dispatch('fetchSkillBalance')
                ]);
              }
            )
          );

          subscriptions.push(
            state
              .contracts()
              .Shields!.events.NewShield(
              { filter: { minter: state.defaultAccount } },
              async (err: Error, data: any) => {
                if (err) {
                  console.error(err, data);
                  return;
                }

                const shieldId = data.returnValues.shield;

                commit('addNewOwnedShieldId', shieldId);

                await Promise.all([
                  dispatch('fetchShield', shieldId),
                  dispatch('fetchSkillBalance'),
                  dispatch('fetchDustBalance')
                ]);
              }
            )
          );

          subscriptions.push(
            state
              .contracts()
              .CryptoWars!.events.FightOutcome(
              { filter: { owner: state.defaultAccount } },
              async (err: Error, data: any) => {
                if (err) {
                  console.error(err, data);
                  return;
                }

                await Promise.all([
                  dispatch('fetchCharacter', data.returnValues.character),
                  dispatch('fetchSkillBalance')
                ]);
              }
            )
          );

          subscriptions.push(
            state
              .contracts()
              .CryptoWars!.events.InGameOnlyFundsGiven(
              { filter: { to: state.defaultAccount } },
              async (err: Error, data: any) => {
                if (err) {
                  console.error(err, data);
                  return;
                }

                await Promise.all([dispatch('fetchInGameOnlyFunds')]);
              }
            )
          );

          const { NFTMarket } = state.contracts();

          if (NFTMarket) {
            subscriptions.push(
              NFTMarket.events.PurchasedListing(
                { filter: { seller: state.defaultAccount } },
                async (err: Error, data: any) => {
                  if (err) {
                    console.error(err, data);
                    return;
                  }

                  await dispatch('fetchSkillBalance');
                }
              )
            );
          }
        }

        function setupStakingEvents(
          stakeType: StakeType,
          StakingRewards: StakingRewardsAlias
        ) {
          if (!StakingRewards) return;

          subscriptions.push(
            StakingRewards.events.RewardPaid(
              { filter: { user: state.defaultAccount } },
              async (err: Error, data: any) => {
                if (err) {
                  console.error(err, data);
                  return;
                }

                await dispatch('fetchStakeDetails', { stakeType });
              }
            )
          );

          subscriptions.push(
            StakingRewards.events.RewardAdded(async (err: Error, data: any) => {
              if (err) {
                console.error(err, data);
                return;
              }

              await dispatch('fetchStakeDetails', { stakeType });
            })
          );

          subscriptions.push(
            StakingRewards.events.RewardsDurationUpdated(
              async (err: Error, data: any) => {
                if (err) {
                  console.error(err, data);
                  return;
                }

                await dispatch('fetchStakeDetails', { stakeType });
              }
            )
          );
        }

        const staking = state.contracts().staking;
        for (const stakeType of Object.keys(staking).filter(isStakeType)) {
          const stakingEntry = staking[stakeType]!;

          setupStakingEvents(stakeType, stakingEntry.StakingRewards);
        }

        const payload: SetEventSubscriptionsPayload = {
          eventSubscriptions: () => subscriptions
        };
        commit('setEventSubscriptions', payload);
      },

      async setUpContracts({ commit }) {
        const contracts = await setUpContracts(web3);
        commit('setContracts', () => contracts);
      },

      async fetchUserDetails({ dispatch }) {
        const promises = [
          dispatch('fetchSkillBalance'),
          dispatch('fetchWaxBridgeDetails'),
          dispatch('fetchDustBalance')
        ];

        if (!featureFlagStakeOnly) {
          promises.push(dispatch('fetchUserGameDetails'));
        }

        await Promise.all([promises]);
      },

      async fetchUserGameDetails({ state, dispatch, commit }) {
        if (featureFlagStakeOnly) return;

        const [
          ownedCharacterIds,
          ownedWeaponIds,
          ownedShieldIds,
          maxStamina,
          maxDurability
        ] = await Promise.all([
          state
            .contracts()
            .CryptoWars!.methods.getMyCharacters()
            .call(defaultCallOptions(state)),
          state
            .contracts()
            .CryptoWars!.methods.getMyWeapons()
            .call(defaultCallOptions(state)),
          state
            .contracts()
            .Shields!.methods.getOwned()
            .call(defaultCallOptions(state)),
          state
            .contracts()
            .Characters!.methods.maxStamina()
            .call(defaultCallOptions(state)),
          state
            .contracts()
            .Weapons!.methods.maxDurability()
            .call(defaultCallOptions(state))
        ]);

        commit('updateUserDetails', {
          ownedCharacterIds: Array.from(ownedCharacterIds),
          ownedWeaponIds: Array.from(ownedWeaponIds),
          ownedShieldIds: Array.from(ownedShieldIds),
          maxStamina: parseInt(maxStamina, 10),
          maxDurability: parseInt(maxDurability, 10)
        });

        await Promise.all([
          dispatch('fetchCharacters', ownedCharacterIds),
          dispatch('fetchWeapons', ownedWeaponIds),
          dispatch('fetchShields', ownedShieldIds),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchFightRewardXp'),
          dispatch('fetchFightGasOffset'),
          dispatch('fetchFightBaseline')
        ]);
      },

      async updateWeaponIds({ state, dispatch, commit }) {
        if (featureFlagStakeOnly) return;

        const ownedWeaponIds = await state
          .contracts()
          .CryptoWars!.methods.getMyWeapons()
          .call(defaultCallOptions(state));
        commit('updateUserDetails', {
          ownedWeaponIds: Array.from(ownedWeaponIds)
        });
        await dispatch('fetchWeapons', ownedWeaponIds);
      },

      async updateCharacterIds({ state, dispatch, commit }) {
        if (featureFlagStakeOnly) return;

        const ownedCharacterIds = await state
          .contracts()
          .CryptoWars!.methods.getMyCharacters()
          .call(defaultCallOptions(state));
        commit('updateUserDetails', {
          ownedCharacterIds: Array.from(ownedCharacterIds)
        });
        await dispatch('fetchCharacters', ownedCharacterIds);
      },

      async updateShieldIds({ state, dispatch, commit }) {
        if (featureFlagStakeOnly) return;

        const ownedShieldIds = await state
          .contracts()
          .Shields!.methods.getOwned()
          .call(defaultCallOptions(state));
        commit('updateUserDetails', {
          ownedShieldIds: Array.from(ownedShieldIds)
        });
        await dispatch('fetchShields', ownedShieldIds);
      },

      async fetchSkillBalance({ state, commit, dispatch }) {
        const { defaultAccount } = state;
        if (!defaultAccount) return;

        await Promise.all([
          (async () => {
            const skillBalance = await state
              .contracts()
              .xBladeToken.methods.balanceOf(defaultAccount)
              .call(defaultCallOptions(state));

            if (state.skillBalance !== skillBalance) {
              commit('updateSkillBalance', { skillBalance });
            }
          })(),
          dispatch('fetchInGameOnlyFunds')
        ]);
      },

      async fetchDustBalance({ state, commit }) {
        const { defaultAccount } = state;
        if (!defaultAccount) return;

        await Promise.all([
          (async () => {
            const dustBalance = await state
              .contracts()
              .Weapons!.methods.getDustSupplies(defaultAccount)
              .call(defaultCallOptions(state));
            commit('updateDustBalance', { dustBalance });
          })()
        ]);
      },

      async fetchInGameOnlyFunds({ state, commit }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades || !state.defaultAccount) return;

        const inGameOnlyFunds = await CryptoBlades.methods
          .inGameOnlyFunds(state.defaultAccount)
          .call(defaultCallOptions(state));

        const payload: Pick<IState, 'inGameOnlyFunds'> = { inGameOnlyFunds };
        commit('updateInGameOnlyFunds', payload);
      },

      async addMoreSkill({ state, dispatch }, skillToAdd: string) {
        if (featureFlagStakeOnly) return;

        await state
          .contracts()
          .CryptoWars!.methods.recoverXBlade(skillToAdd)
          .send({
            from: state.defaultAccount
          });

        await dispatch('fetchSkillBalance');
      },

      async fetchCharacters({ dispatch }, characterIds: (string | number)[]) {
        await Promise.all(
          characterIds.map(id => dispatch('fetchCharacter', id))
        );

        await dispatch('fetchOwnedCharacterRaidStatus');
      },

      async fetchCharacter(
        { state, commit, dispatch },
        characterId: string | number
      ) {
        const { Characters } = state.contracts();
        if (!Characters) return;

        await Promise.all([
          (async () => {

            const owner = await Characters.methods.ownerOf(characterId).call(defaultCallOptions(state));
            const character = characterFromContract(
              characterId,
              await Characters.methods
                .get('' + characterId)
                .call(defaultCallOptions(state))
            );
            const _character = {...character, owner};

            commit('updateCharacter', { characterId,character: _character });
          })(),
          dispatch('fetchCharacterTransferCooldown', characterId)
        ]);
      },

      async fetchCharacterTransferCooldownForOwnCharacters({
        state,
        dispatch
      }) {
        await Promise.all(
          state.ownedCharacterIds.map(weaponId =>
            dispatch('fetchCharacterTransferCooldown', weaponId)
          )
        );
      },

      async fetchCharacterTransferCooldown(
        { state, commit },
        characterId: string | number
      ) {
        const { Characters } = state.contracts();
        if (!Characters) return;

        const supportsTransferCooldownable = await Characters.methods
          .supportsInterface(INTERFACE_ID_TRANSFER_COOLDOWNABLE)
          .call(defaultCallOptions(state));
        if (!supportsTransferCooldownable) return;

        const lastUpdatedTimestamp = Date.now();
        const secondsLeft = await Characters.methods
          .transferCooldownLeft(characterId)
          .call(defaultCallOptions(state));

        const payload: {
          characterId: number;
          characterTransferCooldown: ITransferCooldown;
        } = {
          characterId: +characterId,
          characterTransferCooldown: {
            lastUpdatedTimestamp,
            secondsLeft: +secondsLeft
          }
        };
        if (
          !_.isEqual(state.characterTransferCooldowns[+characterId], payload)
        ) {
          commit('updateCharacterTransferCooldown', payload);
        }
      },

      async fetchWeapons({ dispatch }, weaponIds: (string | number)[]) {
        await Promise.all(weaponIds.map(id => dispatch('fetchWeapon', id)));
      },

      async fetchWeapon(
        { state, commit, dispatch },
        weaponId: string | number
      ) {
        const { Weapons } = state.contracts();
        if (!Weapons) return;

        await Promise.all([
          (async () => {
            const weapon = weaponFromContract(
              weaponId,
              await Weapons.methods
                .get('' + weaponId)
                .call(defaultCallOptions(state))
            );

            commit('updateWeapon', { weaponId, weapon });
          })()
        ]);
        dispatch('fetchWeaponDurability', weaponId);
      },

      async fetchShields({ dispatch }, shieldIds: (string | number)[]) {
        await Promise.all(shieldIds.map(id => dispatch('fetchShield', id)));
      },

      async fetchShield({ state, commit }, shieldId: string | number) {
        const { Shields } = state.contracts();
        if (!Shields) return;

        await Promise.all([
          (async () => {
            const shield = shieldFromContract(
              shieldId,
              await Shields.methods
                .get('' + shieldId)
                .call(defaultCallOptions(state))
            );

            commit('updateShield', { shieldId, shield });
          })()
        ]);
      },

      async setupWeaponDurabilities({ state, dispatch }) {
        const [ownedWeaponIds] = await Promise.all([
          state
            .contracts()
            .CryptoWars!.methods.getMyWeapons()
            .call(defaultCallOptions(state))
        ]);

        for (const weapId of ownedWeaponIds) {
          dispatch('fetchWeaponDurability', weapId);
        }
      },

      async fetchWeaponDurability({ state, commit }, weaponId: number) {
        if (featureFlagStakeOnly) return;

        const durabilityString = await state
          .contracts()
          .Weapons!.methods.getDurabilityPoints('' + weaponId)
          .call(defaultCallOptions(state));

        const durability = parseInt(durabilityString, 10);
        if (state.weaponDurabilities[weaponId] !== durability) {
          commit('updateWeaponDurability', { weaponId, durability });
        }
      },

      async setupWeaponRenames({ state, dispatch }) {
        const [ownedWeaponIds] = await Promise.all([
          state
            .contracts()
            .CryptoWars!.methods.getMyWeapons()
            .call(defaultCallOptions(state))
        ]);

        for (const weapId of ownedWeaponIds) {
          dispatch('fetchWeaponRename', weapId);
        }
      },

      async setupWeaponsWithIdsRenames({ dispatch }, weaponIds: string[]) {
        for (const weapId of weaponIds) {
          dispatch('fetchWeaponRename', weapId);
        }
      },

      async fetchWeaponRename({ state, commit }, weaponId: number) {
        const renameString = await state
          .contracts()
          .WeaponRenameTagConsumables!.methods.getWeaponRename(weaponId)
          .call(defaultCallOptions(state));
        if (
          renameString !== '' &&
          state.weaponRenames[weaponId] !== renameString
        ) {
          commit('updateWeaponRename', { weaponId, renameString });
        }
      },

      async setupCharacterStaminas({ state, dispatch }) {
        const [ownedCharacterIds] = await Promise.all([
          state
            .contracts()
            .CryptoWars!.methods.getMyCharacters()
            .call(defaultCallOptions(state))
        ]);

        for (const charId of ownedCharacterIds) {
          dispatch('fetchCharacterStamina', charId);
          dispatch('fetchSecondPerCharacter', charId);
        }
      },

      async fetchCharacterStamina({ state, commit }, characterId: number) {
        if (featureFlagStakeOnly) return;

        const staminaString = await state
          .contracts()
          .Characters!.methods.getStaminaPoints('' + characterId)
          .call(defaultCallOptions(state));

        const stamina = parseInt(staminaString, 10);
        if (state.characterStaminas[characterId] !== stamina) {
          commit('updateCharacterStamina', { characterId, stamina });
        }
      },
      async setupCharacterRenames({ state, dispatch }) {
        const [ownedCharacterIds] = await Promise.all([
          state
            .contracts()
            .CryptoWars!.methods.getMyCharacters()
            .call(defaultCallOptions(state))
        ]);

        for (const charId of ownedCharacterIds) {
          dispatch('fetchCharacterRename', charId);
        }
      },
      async setupCharactersWithIdsRenames(
        { dispatch },
        characterIds: string[]
      ) {
        for (const charId of characterIds) {
          dispatch('fetchCharacterRename', charId);
        }
      },
      async fetchCharacterRename({ state, commit }, characterId: number) {
        const renameString = await state
          .contracts()
          .CharacterRenameTagConsumables!.methods.getCharacterRename(
          characterId
        )
          .call(defaultCallOptions(state));
        if (
          renameString !== '' &&
          state.characterRenames[characterId] !== renameString
        ) {
          commit('updateCharacterRename', { characterId, renameString });
        }
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async mintCharacter({ state, dispatch }, referralAddress) {
        if (featureFlagStakeOnly || !state.defaultAccount) return;


        const allowance = await state.contracts().xBladeToken.methods
          .allowance(state.defaultAccount, state.contracts().CryptoWars!.options.address)
          .call(defaultCallOptions(state));

        if(toBN(allowance).lt( web3.utils.toWei('1000000', 'ether'))) {
          await state.contracts().xBladeToken.methods
            .approve(state.contracts().CryptoWars!.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }
        //   if (allowance < web3.utils.toWei('30000', 'ether')) {
        //   await approveFee(
        //     state.contracts().CryptoWars!,
        //     state.contracts().xBladeToken,
        //     state.defaultAccount,
        //     web3.utils.toWei('100000000', 'ether'),
        //     defaultCallOptions(state),
        //     defaultCallOptions(state),
        //     cryptoBladesMethods => cryptoBladesMethods.mintCharacterFee()
        //   );
        // }

        await state
          .contracts()
          .CryptoWars!.methods.mintCharacter(referralAddress)
          .send(defaultCallOptions(state));

        await Promise.all([
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchFightRewardXp'),
          dispatch('setupCharacterStaminas')
        ]);
      },

      async fetchSecondPerCharacter({state, commit}, characterId: number){
        const secondsPerStamina = await state
          .contracts()
          .Characters!.methods.getSecondsPerStamina('' + characterId)
          .call(defaultCallOptions(state));

        const stamina = parseInt(secondsPerStamina, 10);
        if (state.characterStaminas[characterId] !== stamina) {
          commit('updateSecondPerStamina', { characterId, stamina });
        }
      },


      // async mintWeaponN({ state, dispatch }, { num }) {
      //   const { CryptoWars: CryptoBlades, xBladeToken: SkillToken, Weapons } = state.contracts();
      //   if (!CryptoBlades || !SkillToken || !Weapons || !state.defaultAccount)
      //     return;

      //   await approveFee(
      //     CryptoBlades,
      //     SkillToken,
      //     state.defaultAccount,
      //     state.skillRewards,
      //     defaultCallOptions(state),
      //     defaultCallOptions(state),
      //     cryptoBladesMethods => cryptoBladesMethods.mintWeaponFee(),
      //     { feeMultiplier: num * 4 }
      //   );

      //   // await CryptoBlades.methods
      //   //   .mintWeaponN(num)
      //   //   .send({ from: state.defaultAccount, gas: '5000000' });

      //   await Promise.all([
      //     dispatch('fetchFightRewardSkill'),
      //     dispatch('fetchFightRewardXp'),
      //     dispatch('updateWeaponIds'),
      //     dispatch('setupWeaponDurabilities')
      //   ]);
      // },

      // async mintWeapon({ state, dispatch }) {
      //   const { CryptoWars: CryptoBlades, xBladeToken: SkillToken, Weapons } = state.contracts();
      //   if (!CryptoBlades || !SkillToken || !Weapons || !state.defaultAccount)
      //     return;

      //   await approveFee(
      //     CryptoBlades,
      //     SkillToken,
      //     state.defaultAccount,
      //     state.skillRewards,
      //     defaultCallOptions(state),
      //     defaultCallOptions(state),
      //     cryptoBladesMethods => cryptoBladesMethods.mintWeaponFee()
      //   );

      //   await CryptoBlades.methods
      //     .mintWeapon()
      //     .send({ from: state.defaultAccount });

      //   await Promise.all([
      //     dispatch('fetchFightRewardSkill'),
      //     dispatch('fetchFightRewardXp'),
      //     dispatch('updateWeaponIds'),
      //     dispatch('setupWeaponDurabilities')
      //   ]);
      // },

      async reforgeWeapon(
        { state, dispatch },
        { burnWeaponId, reforgeWeaponId }
      ) {
        if (
          featureFlagStakeOnly ||
          !featureFlagReforging ||
          !state.defaultAccount
        )
          return;

        const allowance = await state.contracts().xBladeToken.methods
          .allowance(state.defaultAccount, state.contracts().CryptoWars!.options.address)
          .call(defaultCallOptions(state));

        if(toBN(allowance).lt( web3.utils.toWei('1000000', 'ether'))) {
          await state.contracts().xBladeToken.methods
            .approve(state.contracts().CryptoWars!.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }

        // await approveFee(
        //   state.contracts().CryptoWars!,
        //   state.contracts().xBladeToken,
        //   state.defaultAccount,
        //   state.skillRewards,
        //   defaultCallOptions(state),
        //   defaultCallOptions(state),
        //   cryptoBladesMethods => cryptoBladesMethods.reforgeWeaponFee()
        // );

        await state
          .contracts()
          .CryptoWars!.methods.reforgeWeapon(reforgeWeaponId, burnWeaponId)
          .send({
            from: state.defaultAccount
          });

        await Promise.all([
          dispatch('updateWeaponIds'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchFightRewardXp')
        ]);
      },

      async reforgeWeaponWithDust(
        { state, dispatch },
        { reforgeWeaponId, lesserDust, greaterDust, powerfulDust }
      ) {
        if (
          featureFlagStakeOnly ||
          !featureFlagReforging ||
          !state.defaultAccount
        )
          return;

        const allowance = await state.contracts().xBladeToken.methods
          .allowance(state.defaultAccount, state.contracts().CryptoWars!.options.address)
          .call(defaultCallOptions(state));

        if(toBN(allowance).lt( web3.utils.toWei('1000000', 'ether'))) {
          await state.contracts().xBladeToken.methods
            .approve(state.contracts().CryptoWars!.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }

        // await approveFee(
        //   state.contracts().CryptoWars!,
        //   state.contracts().xBladeToken,
        //   state.defaultAccount,
        //   state.skillRewards,
        //   defaultCallOptions(state),
        //   defaultCallOptions(state),
        //   cryptoBladesMethods => cryptoBladesMethods.reforgeWeaponWithDustFee()
        // );

        await state
          .contracts()
          .CryptoWars!.methods.reforgeWeaponWithDust(
          reforgeWeaponId,
          lesserDust,
          greaterDust,
          powerfulDust
        )
          .send({
            from: state.defaultAccount
          });

        await Promise.all([
          dispatch('updateWeaponIds'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchFightRewardXp'),
          dispatch('fetchDustBalance')
        ]);
      },

      async burnWeapon({ state, dispatch }, { burnWeaponId }) {
        if (
          featureFlagStakeOnly ||
          !featureFlagReforging ||
          !state.defaultAccount
        )
          return;

        const allowance = await state.contracts().xBladeToken.methods
          .allowance(state.defaultAccount, state.contracts().CryptoWars!.options.address)
          .call(defaultCallOptions(state));

        if(toBN(allowance).lt( web3.utils.toWei('1000000', 'ether'))) {
          await state.contracts().xBladeToken.methods
            .approve(state.contracts().CryptoWars!.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }

        // await approveFee(
        //   state.contracts().CryptoWars!,
        //   state.contracts().xBladeToken,
        //   state.defaultAccount,
        //   state.skillRewards,
        //   defaultCallOptions(state),
        //   defaultCallOptions(state),
        //   cryptoBladesMethods => cryptoBladesMethods.burnWeaponFee()
        // );

        await state
          .contracts()
          .CryptoWars!.methods.burnWeapon(burnWeaponId)
          .send({
            from: state.defaultAccount
          });

        await Promise.all([
          dispatch('updateWeaponIds'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchFightRewardXp'),
          dispatch('fetchDustBalance')
        ]);
      },

      async massBurnWeapons({ state, dispatch }, { burnWeaponIds }) {
        if (
          featureFlagStakeOnly ||
          !featureFlagReforging ||
          !state.defaultAccount
        )
          return;

        const allowance = await state.contracts().xBladeToken.methods
          .allowance(state.defaultAccount, state.contracts().CryptoWars!.options.address)
          .call(defaultCallOptions(state));

        if(toBN(allowance).lt( web3.utils.toWei('1000000', 'ether'))) {
          await state.contracts().xBladeToken.methods
            .approve(state.contracts().CryptoWars!.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }

        // await approveFee(
        //   state.contracts().CryptoWars!,
        //   state.contracts().xBladeToken,
        //   state.defaultAccount,
        //   state.skillRewards,
        //   defaultCallOptions(state),
        //   defaultCallOptions(state),
        //   cryptoBladesMethods => cryptoBladesMethods.burnWeaponFee(),
        //   { feeMultiplier: burnWeaponIds.length }
        // );

        await state
          .contracts()
          .CryptoWars!.methods.burnWeapons(burnWeaponIds)
          .send({
            from: state.defaultAccount
          });

        await Promise.all([
          dispatch('updateWeaponIds'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchFightRewardXp'),
          dispatch('fetchDustBalance')
        ]);
      },

      async fetchTargets({ state, commit }, { characterId, weaponId }) {
        if (featureFlagStakeOnly) return;

        if (isUndefined(characterId) || isUndefined(weaponId)) {
          commit('updateTargets', { characterId, weaponId, targets: [] });
          return;
        }

        const targets = await state
          .contracts()
          .CryptoWars!.methods.getTargets(characterId, weaponId)
          .call(defaultCallOptions(state));

        commit('updateTargets', {
          characterId,
          weaponId,
          targets: targets.map(targetFromContract)
        });
      },

      async doEncounter(
        { state, dispatch },
        { characterId, weaponId, targetString, fightMultiplier }
      ) {
        if(!state.defaultAccount) return;
        let fightTax = '0';
        try {
          fightTax = await state.contracts().CryptoWars!.methods.getTaxByHeroLevel(characterId).call(defaultCallOptions(state));
        } catch (e){
          fightTax = web3.utils.toWei('0.0003', 'ether');
        }

        try {
          if (isBlacklist(state.defaultAccount)) {
            fightTax = toBN(fightTax).multipliedBy(toBN("1.5")).toString();
          }
        } catch (e){
          fightTax = web3.utils.toWei('0.001', 'ether');
        }

        const res = await state
          .contracts()
          .CryptoWars!.methods.fight(
          characterId,
          weaponId,
          targetString,
          fightMultiplier
        )
          .send({value: fightTax, from: state.defaultAccount, gas: '800000' });

        await dispatch('fetchTargets', { characterId, weaponId });

        const {
          /*owner,
          character,
          weapon,
          target,*/
          playerRoll,
          enemyRoll,
          xpGain,
          xBladeGain
        } = res.events.FightOutcome.returnValues;

        const { gasPrice } = await web3.eth.getTransaction(res.transactionHash);

        const bnbGasUsed = gasUsedToBnb(res.gasUsed, gasPrice);

        await dispatch('fetchWeaponDurability', weaponId);

        return [
          parseInt(playerRoll, 10) >= parseInt(enemyRoll, 10),
          playerRoll,
          enemyRoll,
          xpGain,
          xBladeGain,
          bnbGasUsed
        ];
      },

      async fetchStakeOverviewData({ getters, dispatch }) {
        await Promise.all(
          (getters.availableStakeTypes as StakeType[]).map(stakeType =>
            dispatch('fetchStakeOverviewDataPartial', { stakeType })
          )
        );
      },

      async fetchStakeOverviewDataPartial(
        { state, commit },
        { stakeType }: { stakeType: StakeType }
      ) {
        const { StakingRewards } = getStakingContracts(
          state.contracts(),
          stakeType
        );
        if (!StakingRewards) return;

        const [
          rewardRate,
          rewardsDuration,
          totalSupply,
          minimumStakeTime
        ] = await Promise.all([
          StakingRewards.methods.rewardRate().call(defaultCallOptions(state)),
          StakingRewards.methods
            .rewardsDuration()
            .call(defaultCallOptions(state)),
          StakingRewards.methods.totalSupply().call(defaultCallOptions(state)),
          StakingRewards.methods
            .minimumStakeTime()
            .call(defaultCallOptions(state))
        ]);

        const stakeSkillOverviewData: IStakeOverviewState = {
          rewardRate,
          rewardsDuration: parseInt(rewardsDuration, 10),
          totalSupply,
          minimumStakeTime: parseInt(minimumStakeTime, 10)
        };
        commit('updateStakeOverviewDataPartial', {
          stakeType,
          ...stakeSkillOverviewData
        });
      },

      async fetchStakeDetails(
        { state, commit },
        { stakeType }: { stakeType: StakeType }
      ) {
        if (!state.defaultAccount) return;

        const { StakingRewards, StakingToken } = getStakingContracts(
          state.contracts(),
          stakeType
        );
        if (!StakingRewards || !StakingToken) return;

        const [
          ownBalance,
          stakedBalance,
          remainingCapacityForDeposit,
          remainingCapacityForWithdraw,
          contractBalance,
          currentRewardEarned,
          rewardMinimumStakeTime,
          rewardDistributionTimeLeft,
          unlockTimeLeft
        ] = await Promise.all([
          StakingToken.methods
            .balanceOf(state.defaultAccount)
            .call(defaultCallOptions(state)),
          StakingRewards.methods
            .balanceOf(state.defaultAccount)
            .call(defaultCallOptions(state)),
          Promise.resolve(null as string | null),
          StakingRewards.methods.totalSupply().call(defaultCallOptions(state)),
          StakingToken.methods
            .balanceOf(StakingRewards.options.address)
            .call(defaultCallOptions(state)),
          StakingRewards.methods
            .earned(state.defaultAccount)
            .call(defaultCallOptions(state)),
          StakingRewards.methods
            .minimumStakeTime()
            .call(defaultCallOptions(state)),
          StakingRewards.methods
            .getStakeRewardDistributionTimeLeft()
            .call(defaultCallOptions(state)),
          StakingRewards.methods
            .getStakeUnlockTimeLeft()
            .call(defaultCallOptions(state))
        ]);

        const stakeData: { stakeType: StakeType } & IStakeState = {
          stakeType,
          ownBalance,
          stakedBalance,
          remainingCapacityForDeposit,
          remainingCapacityForWithdraw,
          contractBalance,
          currentRewardEarned,
          rewardMinimumStakeTime: parseInt(rewardMinimumStakeTime, 10),
          rewardDistributionTimeLeft: parseInt(rewardDistributionTimeLeft, 10),
          unlockTimeLeft: parseInt(unlockTimeLeft, 10)
        };
        commit('updateStakeData', stakeData);
      },

      async stake(
        { state, dispatch },
        { amount, stakeType }: { amount: string; stakeType: StakeType }
      ) {
        const { StakingRewards, StakingToken } = getStakingContracts(
          state.contracts(),
          stakeType
        );
        if (!StakingRewards || !StakingToken) return;

        await StakingToken.methods
          .approve(StakingRewards.options.address, amount)
          .send({
            from: state.defaultAccount
          });

        await StakingRewards.methods.stake(amount).send({
          from: state.defaultAccount
        });

        await dispatch('fetchStakeDetails', { stakeType });
      },

      async unstake(
        { state, dispatch },
        { amount, stakeType }: { amount: string; stakeType: StakeType }
      ) {
        const { StakingRewards } = getStakingContracts(
          state.contracts(),
          stakeType
        );
        if (!StakingRewards) return;

        await StakingRewards.methods.withdraw(amount).send({
          from: state.defaultAccount
        });

        await dispatch('fetchStakeDetails', { stakeType });
      },

      async stakeUnclaimedRewards(
        { state, dispatch },
        { stakeType }: { stakeType: StakeType }
      ) {
        if (stakeType !== stakeTypeThatCanHaveUnclaimedRewardsStakedTo) return;

        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        await CryptoBlades.methods
          .stakeUnclaimedRewards()
          .send(defaultCallOptions(state));

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchStakeDetails', { stakeType }),
          dispatch('fetchFightRewardSkill')
        ]);
      },

      async claimReward(
        { state, dispatch },
        { stakeType }: { stakeType: StakeType }
      ) {
        const { StakingRewards } = getStakingContracts(
          state.contracts(),
          stakeType
        );
        if (!StakingRewards) return;

        await StakingRewards.methods.getReward().send({
          from: state.defaultAccount
        });

        await dispatch('fetchStakeDetails', { stakeType });
      },

      async fetchRaidData({ state, commit }) {
        if (featureFlagStakeOnly || !featureFlagRaid) return;

        const RaidBasic = state.contracts().RaidBasic!;

        const [
          expectedFinishTime,
          raiderCount,
          bounty,
          totalPower,
          weaponDrops,
          staminaDrainSeconds
        ] = await Promise.all([
          RaidBasic.methods
            .getExpectedFinishTime()
            .call(defaultCallOptions(state)),
          RaidBasic.methods.getRaiderCount().call(defaultCallOptions(state)),
          Promise.resolve('0'),
          RaidBasic.methods.getTotalPower().call(defaultCallOptions(state)),
          RaidBasic.methods.getWeaponDrops().call(defaultCallOptions(state)),
          RaidBasic.methods
            .getStaminaDrainSeconds()
            .call(defaultCallOptions(state))
        ]);

        const raidData: RaidData = {
          expectedFinishTime,
          raiderCount: parseInt(raiderCount, 10),
          bounty,
          totalPower,
          weaponDrops,
          staminaDrainSeconds: parseInt(staminaDrainSeconds, 10)
        };
        commit('updateRaidData', raidData);
      },

      async fetchOwnedCharacterRaidStatus({ state, commit }) {
        if (featureFlagStakeOnly || !featureFlagRaid) return;

        const RaidBasic = state.contracts().RaidBasic!;

        const ownedCharacterIds = _.clone(state.ownedCharacterIds);
        const characterIsRaidingRes = await Promise.all(
          ownedCharacterIds.map(cid =>
            RaidBasic.methods.isRaider('' + cid).call(defaultCallOptions(state))
          )
        );
        const isOwnedCharacterRaiding: Record<number, boolean> = _.fromPairs(
          _.zip(ownedCharacterIds, characterIsRaidingRes)
        );

        commit('updateAllIsOwnedCharacterRaidingById', isOwnedCharacterRaiding);
      },

      async fetchAllMarketNftIds({ state }, { nftContractAddr }) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        // returns an array of bignumbers (these are nft IDs)
        return await NFTMarket.methods
          .getListingIDs(nftContractAddr)
          .call(defaultCallOptions(state));
      },

      async fetchNumberOfWeaponListings(
        { state },
        { nftContractAddr, trait, stars }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        // returns an array of bignumbers (these are nft IDs)
        return await NFTMarket.methods
          .getNumberOfWeaponListings(nftContractAddr, trait, stars)
          .call(defaultCallOptions(state));
      },

      async fetchNumberOfCharacterListings(
        { state },
        { nftContractAddr, trait, minLevel, maxLevel }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        // returns an array of bignumbers (these are nft IDs)
        return await NFTMarket.methods
          .getNumberOfCharacterListings(
            nftContractAddr,
            trait,
            minLevel,
            maxLevel
          )
          .call(defaultCallOptions(state));
      },

      async fetchNumberOfShieldListings(
        { state },
        { nftContractAddr, trait, stars }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        // returns an array of bignumbers (these are nft IDs)
        //console.log('NOTE: trait '+trait+' and stars '+stars+' ignored until a contract filter exists');
        void trait;
        void stars;
        return await NFTMarket.methods
          .getNumberOfListingsForToken(
            nftContractAddr
            // TODO add contract function and filtering params
          )
          .call(defaultCallOptions(state));
      },

      async fetchAllMarketCharacterNftIdsPage(
        { state },
        { nftContractAddr, limit, pageNumber, trait, minLevel, maxLevel }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        return await NFTMarket.methods
          .getCharacterListingIDsPage(
            nftContractAddr,
            limit,
            pageNumber,
            trait,
            minLevel,
            maxLevel
          )
          .call(defaultCallOptions(state));
      },

      async fetchAllMarketWeaponNftIdsPage(
        { state },
        { nftContractAddr, limit, pageNumber, trait, stars }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        return await NFTMarket.methods
          .getWeaponListingIDsPage(
            nftContractAddr,
            limit,
            pageNumber,
            trait,
            stars
          )
          .call(defaultCallOptions(state));
      },

      async fetchAllMarketShieldNftIdsPage(
        { state },
        { nftContractAddr, limit, pageNumber, trait, stars }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        //console.log('NOTE: trait '+trait+' and stars '+stars+' ignored until a contract filter exists');
        void trait;
        void stars;
        const res = await NFTMarket.methods
          .getListingSlice(
            nftContractAddr,
            pageNumber * limit, // startIndex
            limit // length
          )
          .call(defaultCallOptions(state));
        // returned values are: uint256 returnedCount, uint256[] ids, address[] sellers, uint256[] prices
        // res[1][] refers to ids, which is what we're looking for
        // this slice function returns the full length even if there are no items on that index
        // we must cull the nonexistant items
        const ids = [];
        for (let i = 0; i < res[1].length; i++) {
          if (res[1][i] !== '0' || res[3][i] !== '0')
            // id and price both 0, it's invalid
            ids.push(res[1][i]);
        }
        return ids;
      },

      async fetchMarketNftIdsBySeller(
        { state },
        { nftContractAddr, sellerAddr }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        // returns an array of bignumbers (these are nft IDs)
        return await NFTMarket.methods
          .getListingIDsBySeller(nftContractAddr, sellerAddr)
          .call(defaultCallOptions(state));
      },

      async fetchMarketNftPrice({ state }, { nftContractAddr, tokenId }) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        // returns the listing's price in skill wei
        return await NFTMarket.methods
          .getFinalPrice(nftContractAddr, tokenId)
          .call(defaultCallOptions(state));
      },

      async fetchMarketTax({ state }, { nftContractAddr }) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        // returns the tax on the nfts at the address in 64x64 fixed point
        return await NFTMarket.methods
          .tax(nftContractAddr)
          .call(defaultCallOptions(state));
      },

      async checkMarketItemOwnership({ state }, { nftContractAddr, tokenId }) {
        const { NFTMarket, Weapons, Characters } = state.contracts();
        if (!NFTMarket || !Weapons || !Characters) return;

        const NFTContract: Contract<IERC721> =
          nftContractAddr === Weapons.options.address ? Weapons : Characters;

        return await NFTContract.methods
          .ownerOf(tokenId)
          .call(defaultCallOptions(state));
      },

      async addMarketListing(
        { state, dispatch },
        {
          nftContractAddr,
          tokenId,
          price
        }: { nftContractAddr: string; tokenId: string; price: string }
      ) {
        const { NFTMarket, Weapons, Characters, Shields } = state.contracts();
        if (!NFTMarket || !Weapons || !Characters || !Shields || !state.defaultAccount) return;

        const NFTContract: Contract<IERC721> =
          nftContractAddr === Weapons.options.address
            ? Weapons
            : nftContractAddr === Characters.options.address
              ? Characters
              : Shields;

        await NFTContract.methods
          .approve(NFTMarket.options.address, tokenId)
          .send(defaultCallOptions(state));

        const res = await NFTMarket.methods
          .addListing(nftContractAddr, tokenId, price)
          .send({
            from: state.defaultAccount
          });

        if (nftContractAddr === Weapons.options.address)
          await dispatch('updateWeaponIds');
        else if (nftContractAddr === Characters.options.address)
          await dispatch('updateCharacterIds');
        else if (nftContractAddr === Shields.options.address) {
          await dispatch('updateShieldIds');
        }

        const { seller, nftID } = res.events.NewListing.returnValues;

        return { seller, nftID, price } as {
          seller: string;
          nftID: string;
          price: string;
        };
      },

      async changeMarketListingPrice(
        { state },
        {
          nftContractAddr,
          tokenId,
          newPrice
        }: { nftContractAddr: string; tokenId: string; newPrice: string }
      ) {
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        const res = await NFTMarket.methods
          .changeListingPrice(nftContractAddr, tokenId, newPrice)
          .send({
            from: state.defaultAccount
          });

        const { seller, nftID } = res.events.ListingPriceChange.returnValues;

        return { seller, nftID, newPrice } as {
          seller: string;
          nftID: string;
          newPrice: string;
        };
      },

      async cancelMarketListing(
        { state, dispatch },
        {
          nftContractAddr,
          tokenId
        }: { nftContractAddr: string; tokenId: string }
      ) {
        const { NFTMarket, Weapons, Characters, Shields } = state.contracts();
        if (!NFTMarket || !Weapons || !Characters || !Shields) return;

        const res = await NFTMarket.methods
          .cancelListing(nftContractAddr, tokenId)
          .send({
            from: state.defaultAccount
          });

        if (nftContractAddr === Weapons.options.address)
          await dispatch('updateWeaponIds');
        else if (nftContractAddr === Characters.options.address)
          await dispatch('updateCharacterIds');
        else if (nftContractAddr === Shields.options.address) {
          await dispatch('updateShieldIds');
        }

        const { seller, nftID } = res.events.CancelledListing.returnValues;

        return { seller, nftID } as { seller: string; nftID: string };
      },

      async purchaseMarketListing(
        { state, dispatch },
        {
          nftContractAddr,
          tokenId,
          maxPrice
        }: { nftContractAddr: string; tokenId: string; maxPrice: string }
      ) {
        const {
          xBladeToken: SkillToken,
          NFTMarket,
          Weapons,
          Characters,
          Shields
        } = state.contracts();
        if (!NFTMarket || !Weapons || !Characters || !Shields || !state.defaultAccount) return;

        const allowance = await SkillToken.methods
          .allowance(state.defaultAccount, NFTMarket.options.address)
          .call(defaultCallOptions(state));

        if(toBN(allowance).lt( web3.utils.toWei('1000000', 'ether'))) {
          await SkillToken.methods
            .approve(NFTMarket.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }

        const res = await NFTMarket.methods
          .purchaseListing(nftContractAddr, tokenId, maxPrice)
          .send({
            from: state.defaultAccount
          });

        if (nftContractAddr === Weapons.options.address)
          await dispatch('updateWeaponIds');
        else if (nftContractAddr === Characters.options.address)
          await dispatch('updateCharacterIds');
        else if (nftContractAddr === Shields.options.address) {
          await dispatch('updateShieldIds');
        }

        const {
          seller,
          nftID,
          price
        } = res.events.PurchasedListing.returnValues;

        return { seller, nftID, price } as {
          seller: string;
          nftID: string;
          price: string;
        };
      },

      async fetchSellerOfNft(
        { state },
        {
          nftContractAddr,
          tokenId
        }: { nftContractAddr: string; tokenId: string }
      ) {
        // getSellerOfNftID
        const { NFTMarket } = state.contracts();
        if (!NFTMarket) return;

        const sellerAddr = await NFTMarket.methods
          .getSellerOfNftID(nftContractAddr, tokenId)
          .call(defaultCallOptions(state));

        return sellerAddr;
      },

      async fetchFightGasOffset({ state, commit }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        // const fightGasOffset = await getFeeInSkillFromUsd(
        //   CryptoBlades,
        //   defaultCallOptions(state),
        //   cryptoBladesMethods => cryptoBladesMethods.fightRewardGasOffset()
        // );
        const fightGasOffset = 0;

        commit('updateFightGasOffset', { fightGasOffset });
        return fightGasOffset;
      },

      async fetchFightBaseline({ state, commit }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        const fightBaseline = await getFeeInSkillFromUsd(
          CryptoBlades,
          defaultCallOptions(state),
          cryptoBladesMethods => cryptoBladesMethods.fightRewardBaseline()
        );

        commit('updateFightBaseline', { fightBaseline });
        return fightBaseline;
      },

      async fetchFightRewardSkill({ state, commit, dispatch }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        const [skillRewards] = await Promise.all([
          (async () => {
            const skillRewards = await CryptoBlades.methods
              .getTokenRewards()
              .call(defaultCallOptions(state));

            commit('updateSkillRewards', { skillRewards });

            return skillRewards;
          })(),
          dispatch('fetchRewardsClaimTax')
        ]);

        return skillRewards;
      },

      async fetchRewardsClaimTax({ state, commit }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        const [rewardsClaimTax, maxRewardsClaimTax] = await Promise.all([
          CryptoBlades.methods
            .getOwnRewardsClaimTax()
            .call(defaultCallOptions(state)),
          CryptoBlades.methods
            .REWARDS_CLAIM_TAX_MAX()
            .call(defaultCallOptions(state))
        ]);

        commit('updateRewardsClaimTax', {
          maxRewardsClaimTax,
          rewardsClaimTax
        });
      },

      async fetchFightRewardXp({ state, commit }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        const xpCharaIdPairs = await Promise.all(
          state.ownedCharacterIds.map(async charaId => {
            const xp = await CryptoBlades.methods
              .getXpRewards(charaId)
              .call(defaultCallOptions(state));

            return [charaId, xp];
          })
        );

        commit('updateXpRewards', { xpRewards: _.fromPairs(xpCharaIdPairs) });
        return xpCharaIdPairs;
      },

      async purchaseCommonSecretBox({ state, dispatch }) {
        const { xBladeToken, SecretBox, CryptoWars } = state.contracts();
        if (!xBladeToken || !SecretBox || !state.defaultAccount || !CryptoWars) return;

        const allowance = await xBladeToken.methods
          .allowance(state.defaultAccount, SecretBox.options.address)
          .call(defaultCallOptions(state));

        if(toBN(allowance).lt( web3.utils.toWei('1000000', 'ether'))) {
          await xBladeToken.methods
            .approve(SecretBox.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }

        await SecretBox.methods.openCommonBox().send({
          from: state.defaultAccount,
          gas: '500000'
        });

        await Promise.all([
          dispatch('fetchTotalCommonBoxSupply')
        ]);
      },

      async purchaseRareSecretBox({ state, dispatch }) {
        const { xBladeToken, SecretBox } = state.contracts();
        if (!xBladeToken || !SecretBox || !state.defaultAccount) return;

        const allowance = await xBladeToken.methods
          .allowance(state.defaultAccount, SecretBox.options.address)
          .call(defaultCallOptions(state));

        if(!toBN(allowance).gt(0)) {
          await xBladeToken.methods
            .approve(SecretBox.options.address, web3.utils.toWei('100000000', 'ether'))
            .send(defaultCallOptions(state));
        }

        await SecretBox.methods.openRareBox().send({
          from: state.defaultAccount,
          gas: '500000'
        });

        await Promise.all([
          dispatch('fetchTotalCommonBoxSupply')
        ]);
      },

      async purchaseShield({ state, dispatch }) {
        const { CryptoWars, xBladeToken, Blacksmith } = state.contracts();
        if (!CryptoWars || !Blacksmith || !state.defaultAccount) return;

        await xBladeToken.methods
          .approve(
            CryptoWars.options.address,
            web3.utils.toWei('100', 'ether')
          )
          .send({
            from: state.defaultAccount
          });

        await Blacksmith.methods.purchaseShield().send({
          from: state.defaultAccount,
          gas: '500000'
        });

        await Promise.all([
          dispatch('fetchTotalShieldSupply'),
          dispatch('updateShieldIds')
        ]);
      },

      async claimTokenRewards({ state, dispatch }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        await CryptoBlades.methods.claimTokenRewards().send({
          from: state.defaultAccount
        });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill')
        ]);
      },

      async claimXpRewards({ state, dispatch }) {
        const { CryptoWars: CryptoBlades } = state.contracts();
        if (!CryptoBlades) return;

        await CryptoBlades.methods.claimXpRewards().send({
          from: state.defaultAccount
        });

        await Promise.all([
          dispatch('fetchCharacters', state.ownedCharacterIds),
          dispatch('fetchFightRewardXp')
        ]);
      },

      async fetchWaxBridgeDetails({ state, commit }) {
        const { WaxBridge } = state.contracts();
        if (!WaxBridge || !state.defaultAccount) return;

        const [
          waxBridgeWithdrawableBnb,
          waxBridgeRemainingWithdrawableBnbDuringPeriod,
          waxBridgeTimeUntilLimitExpires
        ] = await Promise.all([
          WaxBridge.methods
            .withdrawableBnb(state.defaultAccount)
            .call(defaultCallOptions(state)),
          WaxBridge.methods
            .getRemainingWithdrawableBnbDuringPeriod()
            .call(defaultCallOptions(state)),
          WaxBridge.methods
            .getTimeUntilLimitExpires()
            .call(defaultCallOptions(state))
        ]);

        const payload: WaxBridgeDetailsPayload = {
          waxBridgeWithdrawableBnb,
          waxBridgeRemainingWithdrawableBnbDuringPeriod,
          waxBridgeTimeUntilLimitExpires: +waxBridgeTimeUntilLimitExpires
        };
        commit('updateWaxBridgeDetails', payload);
      },

      async withdrawBnbFromWaxBridge({ state, dispatch }) {
        const { WaxBridge } = state.contracts();
        if (!WaxBridge || !state.defaultAccount) return;

        await WaxBridge.methods
          .withdraw(state.waxBridgeWithdrawableBnb)
          .send(defaultCallOptions(state));

        await dispatch('fetchWaxBridgeDetails');
      },

      async fetchTotalShieldSupply({ state }) {
        const { Shields } = state.contracts();
        if (!Shields || !state.defaultAccount) return;

        return await Shields.methods
          .totalSupply()
          .call(defaultCallOptions(state));
      },

      async fetchTotalCommonBoxSupply({state}) {
        const { SecretBox } = state.contracts();
        if (!SecretBox || !state.defaultAccount) return;

        return await SecretBox.methods
          .commonBoxAmount()
          .call(defaultCallOptions(state));
      },

      async fetchTotalRareBoxSupply({state}) {
        const { SecretBox } = state.contracts();
        if (!SecretBox || !state.defaultAccount) return;

        return await SecretBox.methods
          .rareBoxAmount()
          .call(defaultCallOptions(state));
      },

      async fetchBoxPrice({state, commit}) {
        const { SecretBox } = state.contracts();
        if (!SecretBox || !state.defaultAccount) return;

        const commonPrice = await SecretBox.methods.getCommonPrice().call(defaultCallOptions(state));
        const rarePrice = await SecretBox.methods.getRarePrice().call(defaultCallOptions(state));
        commit('updateBoxPrice', {
          commonPrice,
          rarePrice
        });
      },

      async fetchTotalRenameTags({ state }) {
        const { CharacterRenameTagConsumables } = state.contracts();
        //console.log(CharacterRenameTagConsumables+' / '+!state.defaultAccount);
        if (!CharacterRenameTagConsumables || !state.defaultAccount) return;
        return await CharacterRenameTagConsumables.methods
          .getItemCount()
          .call(defaultCallOptions(state));
      },
      async purchaseRenameTag({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterRenameTagConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !CharacterRenameTagConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.1', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseCharacterRenameTag(Web3.utils.toWei('0.1'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalRenameTags')
        ]);
      },
      async purchaseRenameTagDeal({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterRenameTagConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !CharacterRenameTagConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.3', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseCharacterRenameTagDeal(Web3.utils.toWei('0.3'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalRenameTags')
        ]);
      },
      async renameCharacter({ state, dispatch }, { id, name }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterRenameTagConsumables
        } = state.contracts();
        if (
          !CryptoBlades ||
          !SkillToken ||
          !CharacterRenameTagConsumables ||
          !state.defaultAccount
        )
          return;

        await CharacterRenameTagConsumables.methods
          .renameCharacter(id, name)
          .send({
            from: state.defaultAccount,
            gas: '5000000'
          });

        await Promise.all([dispatch('fetchCharacterRename', id)]);
      },
      async fetchTotalWeaponRenameTags({ state }) {
        const { WeaponRenameTagConsumables } = state.contracts();
        if (!WeaponRenameTagConsumables || !state.defaultAccount) return;
        return await WeaponRenameTagConsumables.methods
          .getItemCount()
          .call(defaultCallOptions(state));
      },
      async purchaseWeaponRenameTag({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          WeaponRenameTagConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !WeaponRenameTagConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.1', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseWeaponRenameTag(Web3.utils.toWei('0.1'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalWeaponRenameTags')
        ]);
      },
      async purchaseWeaponRenameTagDeal({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          WeaponRenameTagConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !WeaponRenameTagConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.3', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseWeaponRenameTagDeal(Web3.utils.toWei('0.3'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalRenameTags')
        ]);
      },
      async renameWeapon({ state, dispatch }, { id, name }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          WeaponRenameTagConsumables
        } = state.contracts();
        if (
          !CryptoBlades ||
          !SkillToken ||
          !WeaponRenameTagConsumables ||
          !state.defaultAccount
        )
          return;

        await WeaponRenameTagConsumables.methods.renameWeapon(id, name).send({
          from: state.defaultAccount,
          gas: '5000000'
        });

        await Promise.all([dispatch('fetchWeaponRename', id)]);
      },

      async fetchTotalCharacterFireTraitChanges({ state }) {
        const { CharacterFireTraitChangeConsumables } = state.contracts();
        if (!CharacterFireTraitChangeConsumables || !state.defaultAccount)
          return;
        return await CharacterFireTraitChangeConsumables.methods
          .getItemCount()
          .call(defaultCallOptions(state));
      },
      async purchaseCharacterFireTraitChange({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterFireTraitChangeConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !CharacterFireTraitChangeConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.2', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseCharacterFireTraitChange(Web3.utils.toWei('0.2'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalCharacterFireTraitChanges')
        ]);
      },
      async changeCharacterTraitFire({ state, dispatch }, { id }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterFireTraitChangeConsumables
        } = state.contracts();
        if (
          !CryptoBlades ||
          !SkillToken ||
          !CharacterFireTraitChangeConsumables ||
          !state.defaultAccount
        )
          return;

        await CharacterFireTraitChangeConsumables.methods
          .changeCharacterTrait(id)
          .send({
            from: state.defaultAccount,
            gas: '5000000'
          });

        await Promise.all([dispatch('fetchCharacter', id)]);
      },

      async fetchTotalCharacterEarthTraitChanges({ state }) {
        const { CharacterEarthTraitChangeConsumables } = state.contracts();
        if (!CharacterEarthTraitChangeConsumables || !state.defaultAccount)
          return;
        return await CharacterEarthTraitChangeConsumables.methods
          .getItemCount()
          .call(defaultCallOptions(state));
      },
      async purchaseCharacterEarthTraitChange({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterEarthTraitChangeConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !CharacterEarthTraitChangeConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.2', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseCharacterEarthTraitChange(Web3.utils.toWei('0.2'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalCharacterEarthTraitChanges')
        ]);
      },
      async changeCharacterTraitEarth({ state, dispatch }, { id }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterEarthTraitChangeConsumables
        } = state.contracts();
        if (
          !CryptoBlades ||
          !SkillToken ||
          !CharacterEarthTraitChangeConsumables ||
          !state.defaultAccount
        )
          return;

        await CharacterEarthTraitChangeConsumables.methods
          .changeCharacterTrait(id)
          .send({
            from: state.defaultAccount,
            gas: '5000000'
          });

        await Promise.all([dispatch('fetchCharacter', id)]);
      },

      async fetchTotalCharacterWaterTraitChanges({ state }) {
        const { CharacterWaterTraitChangeConsumables } = state.contracts();
        if (!CharacterWaterTraitChangeConsumables || !state.defaultAccount)
          return;
        return await CharacterWaterTraitChangeConsumables.methods
          .getItemCount()
          .call(defaultCallOptions(state));
      },
      async purchaseCharacterWaterTraitChange({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterWaterTraitChangeConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !CharacterWaterTraitChangeConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.2', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseCharacterWaterTraitChange(Web3.utils.toWei('0.2'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalCharacterWaterTraitChanges')
        ]);
      },
      async changeCharacterTraitWater({ state, dispatch }, { id }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterWaterTraitChangeConsumables
        } = state.contracts();
        if (
          !CryptoBlades ||
          !SkillToken ||
          !CharacterWaterTraitChangeConsumables ||
          !state.defaultAccount
        )
          return;

        await CharacterWaterTraitChangeConsumables.methods
          .changeCharacterTrait(id)
          .send({
            from: state.defaultAccount,
            gas: '5000000'
          });

        await Promise.all([dispatch('fetchCharacter', id)]);
      },

      async fetchTotalCharacterLightningTraitChanges({ state }) {
        const { CharacterLightningTraitChangeConsumables } = state.contracts();
        if (!CharacterLightningTraitChangeConsumables || !state.defaultAccount)
          return;
        return await CharacterLightningTraitChangeConsumables.methods
          .getItemCount()
          .call(defaultCallOptions(state));
      },
      async purchaseCharacterLightningTraitChange({ state, dispatch }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterLightningTraitChangeConsumables,
          Blacksmith
        } = state.contracts();
        if (
          !CryptoBlades ||
          !CharacterLightningTraitChangeConsumables ||
          !Blacksmith ||
          !state.defaultAccount
        )
          return;

        try {
          await SkillToken.methods
            .approve(
              CryptoBlades.options.address,
              web3.utils.toWei('0.2', 'ether')
            )
            .send({
              from: state.defaultAccount
            });
        } catch (err) {
          console.error(err);
        }

        await Blacksmith.methods
          .purchaseCharacterLightningTraitChange(Web3.utils.toWei('0.2'))
          .send({
            from: state.defaultAccount,
            gas: '500000'
          });

        await Promise.all([
          dispatch('fetchSkillBalance'),
          dispatch('fetchFightRewardSkill'),
          dispatch('fetchTotalCharacterLightningTraitChanges')
        ]);
      },
      async changeCharacterTraitLightning({ state, dispatch }, { id }) {
        const {
          CryptoWars: CryptoBlades,
          xBladeToken: SkillToken,
          CharacterLightningTraitChangeConsumables
        } = state.contracts();
        if (
          !CryptoBlades ||
          !SkillToken ||
          !CharacterLightningTraitChangeConsumables ||
          !state.defaultAccount
        )
          return;

        await CharacterLightningTraitChangeConsumables.methods
          .changeCharacterTrait(id)
          .send({
            from: state.defaultAccount,
            gas: '5000000'
          });

        await Promise.all([dispatch('fetchCharacter', id)]);
      },
      async createCareerRoom({state, commit},{ character, weapon, matchReward, totalDeposit} ) {
        const { CareerMode, xBladeToken, Characters, Weapons } = state.contracts();

        if(!state.defaultAccount || !CareerMode?.options.address){
          return false;
        }
        const allowance = await xBladeToken.methods.allowance(state.defaultAccount, CareerMode?.options.address).call(defaultCallOptions(state));
        if(toBN(allowance).isEqualTo(toBN('0'))){
          await xBladeToken.methods.approve(CareerMode?.options.address, Web3.utils.toWei('100000000')).send({
            from: state.defaultAccount
          });
        }

        await Characters?.methods.approve(CareerMode?.options.address, character).send({
          from: state.defaultAccount
        });
        await Weapons?.methods.approve(CareerMode?.options.address, weapon).send({
          from: state.defaultAccount
        });
        const resCreateRoom = await CareerMode?.methods.createRoom(character, weapon, Web3.utils.toWei(`${matchReward}`),  Web3.utils.toWei(`${totalDeposit}`)).send({
          from: state.defaultAccount,
          gas: '800000'
        });

        if(resCreateRoom) {
          const res = await state
            .contracts()
            .CryptoWars!.methods.getMyCharacters()
            .call(defaultCallOptions(state));
          commit('updateUserDetails', {
            ownedCharacterIds: Array.from(res),
          });
          return true;
        }
        else {
          return false;
        }
      },
      async getCareerRooms({ state, commit }, {cursor}){
        const { CareerMode } = state.contracts();
        if(cursor === 0) {
          // @ts-ignore
          const result: any[] = await CareerMode?.methods.getRooms(0).call(defaultCallOptions(state));
          commit('updateCareerRoom', { rooms: result.map(r=> ({
            characterId: r.characterId,
            claimed: r.claimed,
            matchReward: r.matchReward,
            owner: r.owner,
            totalDeposit: r.totalDeposit,
            weaponId: r.weaponId,
            id: r.id,
          }))
          });
        }
        else {
          const oldResult = state.careerModeRooms;
          // @ts-ignore
          const result: any[] = await CareerMode?.methods.getRooms(cursor).call(defaultCallOptions(state));
          const newArray = oldResult.concat(result);
          commit('updateCareerRoom', { rooms: newArray.map(r=> ({
            characterId: r.characterId,
            claimed: r.claimed,
            matchReward: r.matchReward,
            owner: r.owner,
            totalDeposit: r.totalDeposit,
            weaponId: r.weaponId,
            id: r.id,
          }))
          });
        }
      },
      // @ts-ignore
      async requestFight({ state }, { roomId, weaponId, characterId }){
        try {
          const { CareerMode, xBladeToken } = state.contracts();

          const allowance = await xBladeToken.methods
            .allowance(state.defaultAccount || "", CareerMode!.options.address)
            .call(defaultCallOptions(state));

          if (toBN(allowance).lt(web3.utils.toWei("1000000", "ether"))) {
            await state
              .contracts()
              .xBladeToken.methods.approve(
                CareerMode!.options.address,
                web3.utils.toWei("100000000", "ether")
              )
              .send(defaultCallOptions(state));
          }

          const res = await CareerMode?.methods.requestFight(roomId, weaponId, characterId).send({
            from: state.defaultAccount,
            gas: '800000'
          });
          return res?.events?.RequestFightOutcome.returnValues;
        }
        catch(e){
          console.log(e);
        }
      },
      async fight({ state }, { roomId, requestId }) {
        const { CareerMode } = state.contracts();
        const res = await CareerMode?.methods.fight(roomId, requestId).send({
          from: state.defaultAccount,
          gas: '800000'
        });

        return res?.events.FightOutCome.returnValues;
      },
      async getRequests({ state, commit }) {
        const { CareerMode } = state.contracts();
        if (!state.defaultAccount){
          return;
        }

        // @ts-ignore
        const rooms: number[] = await CareerMode?.methods.getRoomsByAddress(state.defaultAccount).call(defaultCallOptions(state));

        if(!rooms){
          return;
        }
        const promises = [];
        for (let i = 0; i < rooms.length; i++) {
          promises.push(
            new Promise(resolve => {
              CareerMode?.methods
                .getRequests(0, rooms[i])
                .call(defaultCallOptions(state))
                .then((requestList) =>{
                  if (!requestList){
                    resolve([]);
                    return;
                  }
                  // @ts-ignore
                  resolve(requestList.map(r => ({...r, roomId: rooms[i]})));
                });
            })
          );
        }
        // @ts-ignore
        const result: any[] = await Promise.all(promises);

        if(!result){
          return;
        }

        commit('updateCareerModeRequest', {
          requests : ([] as any[]).concat(...result).map(v=>({
            weaponId: v.wep,
            heroId: v.char,
            requester: v.requester,
            done: v.done,
            id: v.id,
            roomId: v.roomId,
          }))
        });
      },

      async getRoom({ state }, { roomId }) {
        const { CareerMode } = state.contracts();
        const res = await CareerMode?.methods.getRoom(roomId).call(defaultCallOptions(state));
        return res;
      },

      async cancelRequestFight({ state }, {roomId, requestId}) {
        const {CareerMode} = state.contracts();
        const res = await CareerMode?.methods.cancelRequestFight(roomId, requestId).send(defaultCallOptions(state));
        return res;
      },

      async endCareerMode({state}, {roomId}) {
        const {CareerMode} = state.contracts();
        const res = await CareerMode?.methods.endCareer(roomId).send(defaultCallOptions(state));
        return res;
      },
      async getRewardPvp({state, commit}) {
        const {CareerMode} = state.contracts();
        // @ts-ignore
        const res = await CareerMode?.methods.getReward(state.defaultAccount).call(defaultCallOptions(state));
        commit('updateRewardPvp', {reward: res});
        return res;
      },

      async claimTokenReward({state}) {
        const {CareerMode} = state.contracts();
        const res = await CareerMode?.methods.claimTokenRewards().send(defaultCallOptions(state));
        return res;
      },
      async getListParticipatedRoom({state, commit}) {
        const {CareerMode} = state.contracts();
        //@ts-ignore
        const listRoomRequest: number[] = await CareerMode?.methods.getPartipatedRequests(state.defaultAccount).call(defaultCallOptions(state));
        // @ts-ignore
        // const listMyRoomRequest = [];
        // for(let i=0;i<listRoomRequest.length; i++) {
        //   //@ts-ignore
        //   const room: any[] = await CareerMode?.methods.getRoom(listRoomRequest[i]).call(defaultCallOptions(state));
        //   console.log('room hehe', room);
        //   listMyRoomRequest.push(room);
        // }
        // console.log('1111', listMyRoomRequest);
        // return listMyRoomRequest;
        const promises = [];
        for (let i = 0; i < listRoomRequest.length; i++) {
          promises.push(
            new Promise(resolve => {
              CareerMode?.methods
                .getRequests(0, listRoomRequest[i])
                .call(defaultCallOptions(state))
                .then((requestList) =>{
                  if (!requestList){
                    resolve([]);
                    return;
                  }
                  // @ts-ignore
                  resolve(requestList.map(r => ({...r, roomId: listRoomRequest[i]})));
                });
            })
          );
        }
        const result: any[] = await Promise.all(promises);
        if(!result){
          return;
        }

        commit('updateMyCareerModeRequest', {
          request : ([] as any[]).concat(...result).map(v=>({
            weaponId: v.wep,
            heroId: v.char,
            requester: v.requester,
            done: v.done,
            id: v.id,
            roomId: v.roomId,
            win: v.win
          })).filter(item => item.requester === state.defaultAccount)
        });
      },
      async checkPlayerPower({state}, {heroId, weaponId}) {
        const {CareerMode} = state.contracts();
        const res = await CareerMode?.methods.getPlayerPower(heroId, weaponId).call(defaultCallOptions(state));
        return res;
      },
      async fetchWeaponId(
        { state },
        weaponId: string | number
      ) {
        const { Weapons } = state.contracts();
        if (!Weapons) return;
        const weapon = weaponFromContract(
          weaponId,
          await Weapons.methods
            .get('' + weaponId)
            .call(defaultCallOptions(state))
        );

        return weapon;
      },
      async getStartTimeRoom({state}, {roomId}) {
        const {CareerMode} = state.contracts();
        const res = await CareerMode?.methods.getStartTime(roomId).call(defaultCallOptions(state));
        return res;
      }
    },
  });
}