<template>
  <div class="body main-font market">
    <div class="market-hero-weapon" style="max-width: 1769px; margin-left: auto; margin-right: auto;">
      <button @click="activeType = 'character'; searchAllCharacterListings(currentPage - 1)" :class="activeType === 'character' && 'selected'">HERO</button>
      <button @click="activeType = 'weapon'; searchAllWeaponListings(currentPage - 1)" :class="activeType === 'weapon' && 'selected'">WEAPON</button>
    </div>
    <b-tabs justified style="max-width: 1769px; margin-left: auto; margin-right: auto;">
      <b-tab @click="clearData();browseTabActive = true;skillShopTabActive = false;searchAllCharacterListings(currentPage - 1)">
        <template #title>
          ON SALES NFTS
          <hint class="hint" text="NFT stands for Non Fungible Token.<br>Weapons and Characters are NFTs of the ERC721 standard" />
        </template>
        <div class="row mt-3">
          <div class="col">
            <div class="search-results">
              <weapon-grid
                v-on:weapon-filters-changed="searchAllWeaponListings(0)"
                v-show="activeType === 'weapon'"
                :showGivenWeaponIds="true"
                :weaponIds="allSearchResults"
                :showLimit="weaponShowLimit"
                :showReforgedToggle="false"
                :showFavoriteToggle="false"
                :canFavorite="false"
                :isMarket="true"
                v-model="selectedNftId"
                showFilters
              >
                <template #above="{ weapon: { id } }">
                  <div class="d-flex flex-column align-items-center justify-content-center m-top-negative-5">
                    <span class="d-block text-center fix-h24" v-if="nftPricesById[id]">
                      <span v-if="convertWeiToSkill(nftPricesById[id]) !== '0'"
                      v-tooltip.top="{ content: maxPrecisionSkill(nftPricesById[id]) , trigger: (isMobile() ? 'click' : 'hover') }"
                      @mouseover="hover = !isMobile() || true"
                      @mouseleave="hover = !isMobile()"
                      class="value-price">
                        Price <span>{{ convertWeiToSkill(nftPricesById[id])  | dynamicDecimals(2, 4) }}</span> xBlade
                      </span>
                    </span>
                    <span class="d-block text-center" v-else>Loading price...</span>
                    <button
                      :hidden="convertWeiToSkill(nftPricesById[id]) === '0'"
                      @click="selectedNftId = id; purchaseNft();"
                      variant="primary"
                      class="gtag-link-others btn-purchase">
                      {{ convertWeiToSkill(nftPricesById[id]) !== '0' ? 'PURCHASE' : 'SOLD' }}
                    </button>
                  </div>
                </template>
                <template #sold="{ weapon: { id } }">
                  <div class="sold" v-if="nftPricesById[id] && convertWeiToSkill(nftPricesById[id]) === '0'"><span>sold</span></div>
                </template>
              </weapon-grid>
              <character-list
                v-on:character-filters-changed="searchAllCharacterListings(0)"
                v-show="activeType === 'character'"
                :showFilters="true"
                :showGivenCharacterIds="true"
                :characterIds="allSearchResults"
                :showLimit="characterShowLimit"
                :isMarket="true"
                v-model="selectedNftId">
                <template #above="{ character: { id } }">
                  <div class="price token-price d-flex flex-column align-items-center justify-content-center m-top-negative-50">
                    <span class="d-block text-center fix-h24" v-if="nftPricesById[id]">
                      <span v-if="convertWeiToSkill(nftPricesById[id]) !== '0'"
                      v-tooltip.top="{ content: maxPrecisionSkill(nftPricesById[id]) , trigger: (isMobile() ? 'click' : 'hover') }"
                      @mouseover="hover = !isMobile() || true"
                      @mouseleave="hover = !isMobile()"
                      class="value-price">
                      Price <span>{{ convertWeiToSkill(nftPricesById[id]) | dynamicDecimals(2, 4) }}</span> xBlade
                      </span>
                    </span>
                    <span class="d-block text-center" v-else>Loading price...</span>
                    <button
                      :hidden="convertWeiToSkill(nftPricesById[id]) === '0'"
                      @click="selectedNftId = id; canPurchase && purchaseNft();"
                      variant="primary"
                      v-bind:class="[!canPurchase ? 'disabled-button' : '']"
                      class="gtag-link-others btn-purchase" tagname="confirm_purchase">
                        {{ convertWeiToSkill(nftPricesById[id]) !== '0' ? 'PURCHASE' : 'SOLD' }} <b-icon-question-circle v-if="!canPurchase"
                      v-tooltip.bottom="'You already have max amount of characters (8).'"/>
                    </button>
                  </div>
                </template>
                <template #sold="{ character: { id } }">
                  <div class="sold" v-if="nftPricesById[id] && convertWeiToSkill(nftPricesById[id]) === '0'"><span>sold</span></div>
                </template>
              </character-list>
            </div>
          </div>
        </div>

        <div class="overlay" v-if="waitingMarketOutcome || marketOutcome">
          <div class="marketoutcome-panel">
            <div class="outcome" v-if="waitingMarketOutcome">
              <i class="fas fa-spinner fa-spin"></i>
              Loading...
            </div>
            <div class="marketoutcome-panel-content" v-if="!waitingMarketOutcome">
              <span class="marketoutcome-panel-heading" v-if="marketOutcomeHeading !== null">{{ marketOutcomeHeading }}</span>
              <ul class="marketoutcome-list">
                <li class="marketoutcome-item" v-if="marketOutcomeActiveType">
                  <span class="marketoutcome-title">Type: </span>
                  <span class="marketoutcome-info">{{ marketOutcomeActiveType }}</span>
                </li>
                <li class="marketoutcome-item" v-if="marketOutcomeID">
                  <span class="marketoutcome-title">ID: </span>
                  <span class="marketoutcome-info">{{ marketOutcomeID }}</span>
                </li>
                <li class="marketoutcome-item" v-if="marketOutcomePrice">
                  <span class="marketoutcome-title">Price: </span>
                  <span class="marketoutcome-info">{{ marketOutcomePrice }}</span>
                </li>
                <li class="marketoutcome-item" v-if="marketOutcomeSeller">
                  <span class="marketoutcome-title">From: </span>
                  <span class="marketoutcome-info">{{ marketOutcomeSeller }}</span>
                </li>
              </ul>
              <div class="button-div">
              <b-button
                @click="marketOutcome = false;"
                variant="primary"
                class="gtag-link-others">
                Accept
              </b-button>
            </div>
            </div>
          </div>
        </div>
      </b-tab>



      <b-tab @click="clearData();loadMarketTaxes();browseTabActive = false;skillShopTabActive = false;isSell=true">
        <template #title>
          MY NFTS
          <hint class="hint" text="When you list an NFT for sale, it is transferred to the<br>market until someone buys it or you cancel the sale" />
        </template>
        <div class="row mt-3">
          <div class="col-12 col-xl-3 col-md-12 col-sm-12">
            <div class="row button-row">
              <input class="form-control" type="text" placeholder="Seller Address, NFT ID">
              <div class="mb-2">
                <b-button
                  @click="activeType = 'weapon'"  class="gtag-link-others  search-btn" tagname="show_weapons_market">Show Weapons</b-button>
              </div>
              <div class="mb-2">
                <b-button
                  @click="activeType = 'character'"  class="gtag-link-others  search-btn" tagname="show_characters_market">Show Characters</b-button>
              </div>

              <div class="mb-2">
                <!-- <b-button
                  v-if="activeType === 'weapon'"
                   class="gtag-link-others  search-btn" tagname="add_listing_weapon"
                  :disabled="selectedNftId === null || selectedNftOnCooldown"
                  @click="showListingSetupModal()">Sell Weapon/Character <b-icon-question-circle :hidden=!weaponMarketTax
                  v-tooltip.bottom="weaponMarketTax + '% tax (paid by the buyer) will be added to the final price.'"/></b-button> -->

                <!-- <b-button
                  v-if="activeType === 'character'"
                  :disabled="selectedNftId === null || selectedNftOnCooldown"
                   class="gtag-link-others search-btn" tagname="add_listing_character"
                  @click="showListingSetupModal()">List Character <b-icon-question-circle :hidden=!characterMarketTax
                  v-tooltip.bottom="characterMarketTax + '% tax (paid by the buyer) will be added to the final price.'"/></b-button> -->

                <b-button
                  v-if="activeType === 'shield'"
                   class="gtag-link-others search-btn" tagname="add_listing_shield"
                  :disabled="selectedNftId === null || selectedNftOnCooldown"
                  @click="showListingSetupModal()">List Shield <b-icon-question-circle :hidden=!shieldMarketTax
                  v-tooltip.bottom="shieldMarketTax + '% tax (paid by the buyer) will be added to the final price.'"/></b-button>

                <b-modal class="centered-modal" ref="listing-setup-modal"
                  @ok="!priceChangeModal ? addListingForNft() : updateNftListingPrice()">
                  <template #modal-title>
                    {{!priceChangeModal ? `Sell ${activeType}` : `Change ${activeType} price`}}
                  </template>
                  <b-form-input type="number" :max="10000"
                    class="modal-input" v-model="listingSellPrice" placeholder="Sell Price (xBlade)" />

                  <span v-if="listingSellPrice">Do you want to sell your {{activeType}} for {{listingSellPrice}} xBlade?<br>
                  <i>The buyer will pay an extra {{activeListingMarketTax()}}% market fee for a total of
                  {{calculatedBuyerCost(listingSellPrice)}} xBlade</i></span>
                </b-modal>
              </div>
              <!-- <div class="mb-2">
                <b-button
                  class="gtag-link-others search-btn" tagname="show_weapons_sold"
                  @click="showWeaponsSoldModal()"> Weapons Sold
                  <b-icon-question-circle v-tooltip.bottom="'View weapons you have sold.'"/>
                </b-button>
                <b-modal class="centered-modal " ref="weapons-sold-modal">
                  <template #modal-header>
                        <div class="transaction-history-header-text">
                          Weapon Transaction History
                        </div>
                  </template>
                  <div v-if="historyCounter > 0">
                    <b-table class="transaction-history-text" :items="weaponTransactionHistoryData" :fields="weaponTransactionHistoryHeader"></b-table>
                  </div>
                  <div v-if="historyCounter === 0">
                    <p>It's seems like there's nothing here.</p>
                    <p>For tips on how to list NFTs, you may click this <strong><a href="https://wiki.cryptowar.network/market/trading" target="_blank">link</a></strong></p>
                  </div>
                  <template #modal-footer>
                  <b-button class="mt-3 btn-buy" block @click="resetTransactionHistoryValues('weapons-sold-modal')">Ok</b-button>
                  </template>
                </b-modal>
              </div>
              <div class="mb-2">
                <b-button
                  class="gtag-link-others  search-btn" tagname="show_characters_sold"
                  @click="showCharactersSoldModal()"> Characters Sold
                  <b-icon-question-circle v-tooltip.bottom="'View characters you have sold.'"/>
                </b-button>
                <b-modal class="centered-modal " ref="characters-sold-modal">
                  <template #modal-header>
                    <div class="transaction-history-header-text">
                      Character Transaction History
                    </div>
                  </template>
                  <div v-if="historyCounter > 0">
                    <b-table class="transaction-history-text" :items="characterTransactionHistoryData" :fields="characterTransactionHistoryHeader"></b-table>
                  </div>
                  <div v-if="historyCounter === 0">
                    <p>It's seems like there's nothing here.</p>
                    <p>For tips on how to list NFTs, you may click this <strong><a href="https://wiki.cryptowar.network/market/trading" target="_blank">link</a></strong></p>
                  </div>
                  <template #modal-footer>
                  <b-button class="mt-3 btn-buy" block @click="resetTransactionHistoryValues('characters-sold-modal')">Ok</b-button>
                  </template>
                </b-modal>
              </div> -->
            </div>
          </div>
          <div class="col-12 col-xl-9 col-md-12 col-sm-12 sell-grid" v-if="activeType === 'weapon'">
            <weapon-grid
              v-model="selectedNftId"
              :showReforgedWeaponsDefVal="true"
              :showFavoriteWeaponsDefVal="true"
              :canFavorite="false"
              :checkBar="false"
              :isSell="isSell"
              :sellClick="showListingSetupModal"
              :checklist="false"
            />
          </div>
          <div class="col-12 col-xl-9 col-md-12 col-sm-12 sell-grid" v-if="activeType === 'character'">
            <character-list
              v-model="selectedNftId"
              :sellClick="showListingSetupModal"
              :isSell="isSell"
              :checklist="false"
            />
          </div>
          <div class="col-12col-xl-3 col-md-12 col-sm-12 sell-grid" v-if="activeType === 'shield'">
            <nft-list
              :isShop="false"
              v-model="selectedNftId"
              :canFavorite="false"
            />
          </div>
        </div>

        <div class="overlay" v-if="waitingMarketOutcome || marketOutcome">
          <div class="marketoutcome-panel">
            <div class="outcome" v-if="waitingMarketOutcome">
              <i class="fas fa-spinner fa-spin"></i>
              Loading...
            </div>
            <div class="marketoutcome-panel-content" v-if="!waitingMarketOutcome">
              <span class="marketoutcome-panel-heading" v-if="marketOutcomeHeading !== null">{{ marketOutcomeHeading }}</span>
              <ul class="marketoutcome-list">
                <li class="marketoutcome-item" v-if="marketOutcomeActiveType">
                  <span class="marketoutcome-title">Type: </span>
                  <span class="marketoutcome-info">{{ marketOutcomeActiveType }}</span>
                </li>
                <li class="marketoutcome-item" v-if="marketOutcomeID">
                  <span class="marketoutcome-title">ID: </span>
                  <span class="marketoutcome-info">{{ marketOutcomeID }}</span>
                </li>
                <li class="marketoutcome-item" v-if="marketOutcomePrice">
                  <span class="marketoutcome-title">Price: </span>
                  <span class="marketoutcome-info">{{ marketOutcomePrice }}</span>
                </li>
                <li class="marketoutcome-item" v-if="marketOutcomeSeller">
                  <span class="marketoutcome-title">From: </span>
                  <span class="marketoutcome-info">{{ marketOutcomeSeller }}</span>
                </li>
              </ul>
              <div class="button-div">
                <b-button
                  @click="marketOutcome = false;"
                  variant="primary"
                  class="gtag-link-others">
                  Accept
                </b-button>
              </div>
            </div>
          </div>
        </div>
      </b-tab>
    </b-tabs>
  </div>
</template>

<script lang="ts">
import assert from 'assert';
import Vue from 'vue';
import CharacterList from '../components/smart/CharacterList.vue';
import WeaponGrid from '../components/smart/WeaponGrid.vue';
import Hint from '../components/Hint.vue';
import Web3 from 'web3';
import { mapActions, mapGetters, mapState } from 'vuex';
import { Accessors } from 'vue/types/options';
import { Contract, Contracts, IState } from '../interfaces';
import { Characters, Weapons, Shields } from '../../../build/abi-interfaces';
import { SkillShopListing } from '../interfaces/SkillShopListing';
import BigNumber from 'bignumber.js';
import { BModal } from 'bootstrap-vue';
import { traitNameToNumber } from '@/contract-models';
import { market_blockchain as useBlockchain } from './../feature-flags';
import { CharacterTransactionHistoryData, ICharacterHistory,
  IWeaponHistory, WeaponTransactionHistoryData,
  IShieldHistory, ShieldTransactionHistoryData } from '@/interfaces/History';
import { getShieldNameFromSeed } from '@/shield-name';
import { fromWeiEther, apiUrl, defaultOptions } from '../utils/common';
import NftList, { NftIdType } from '@/components/smart/NftList.vue';
import { getCleanName } from '../rename-censor';

type SellType = 'weapon' | 'character' | 'shield';
type WeaponId = string;
type CharacterId = string;
type ShieldId = string;
type NftId = WeaponId | CharacterId | ShieldId;

interface Data {
  activeType: SellType;
  search: string;
  searchResults: CharacterId[] | WeaponId[] | NftIdType[];
  allSearchResults: CharacterId[] | WeaponId[] | NftIdType[];
  searchResultsOwned: boolean;
  selectedNftId: NftId | null;
  marketOutcome: boolean;
  marketOutcomeHeading: string | null;
  marketOutcomeActiveType: string | null;
  marketOutcomeID: string | null;
  marketOutcomePrice: string | null;
  marketOutcomeSeller: string | null;
  waitingMarketOutcome: boolean;
  nftPricesById: Record<string, string>;
  characterMarketTax: string;
  weaponMarketTax: string ;
  shieldMarketTax: string;
  characterShowLimit: number;
  weaponShowLimit: number;
  shieldShowLimit: number;
  allListingsAmount: number;
  currentPage: number;
  browseTabActive: boolean;
  skillShopTabActive: boolean;
  listingSellPrice: string;
  priceChangeModal: boolean;
  weaponTransactionHistoryData: WeaponTransactionHistoryData[];
  weaponTransactionHistoryHeader: any;
  characterTransactionHistoryData: CharacterTransactionHistoryData[];
  characterTransactionHistoryHeader: any;
  shieldTransactionHistoryData: ShieldTransactionHistoryData[];
  shieldTransactionHistoryHeader: any;
  historyCounter: number;
  isSell: boolean;
}

type StoreMappedState = Pick<IState, 'defaultAccount' | 'weapons' | 'characters' | 'shields' | 'ownedCharacterIds' | 'ownedWeaponIds' | 'ownedShieldIds'>;

const defaultLimit = 40;

interface StoreMappedGetters {
  contracts: Contracts;
  ownCharacters: any[];
  totalShieldSupply: 0;
  getCharacterName(id: string): string;
  getWeaponName(id: string, stars: number): string;
  getBoxPrice(): { common: string, rare: string };
}

export interface Nft {
  id: string;
  type: string;
  stars?: number;
  element?: string;
  stat1?: string;
  stat2?: string;
  stat3?: string;
  stat1Value?: number;
  stat2Value?: number;
  stat3Value?: number;
  nftPrice?: number;
  isConsumable: boolean;
  name: string;
  description: string;
  image: string;
}

interface StoreMappedActions {
  fetchAllMarketNftIds(payload: { nftContractAddr: string }): Promise<string[]>;
  fetchAllMarketCharacterNftIdsPage(payload: {
    nftContractAddr: string, limit: number, pageNumber: number, trait: number, minLevel: number, maxLevel: number
  }): Promise<string[]>;
  fetchAllMarketWeaponNftIdsPage(payload: { nftContractAddr: string, limit: number, pageNumber: number, trait: number, stars: number }): Promise<string[]>;
  fetchAllMarketShieldNftIdsPage(payload: { nftContractAddr: string, limit: number, pageNumber: number, trait: number, stars: number }): Promise<string[]>;
  fetchNumberOfWeaponListings(payload: { nftContractAddr: string, trait: number, stars: number }): Promise<number>;
  fetchNumberOfCharacterListings(payload: { nftContractAddr: string, trait: number, minLevel: number, maxLevel: number}): Promise<number>;
  fetchNumberOfShieldListings(payload: { nftContractAddr: string, trait: number, stars: number}): Promise<number>;
  fetchMarketNftIdsBySeller(payload: { nftContractAddr: string, sellerAddr: string }): Promise<string[]>;
  fetchMarketNftPrice(payload: { nftContractAddr: string, tokenId: string | number }): Promise<string>;
  fetchMarketTax(payload: { nftContractAddr: string }): Promise<string>;
  checkMarketItemOwnership(payload: { nftContractAddr: string, tokenId: string | number}): Promise<string>;
  addMarketListing(payload: { nftContractAddr: string, tokenId: string, price: string }): Promise<{ seller: string, nftID: string, price: string }>;
  changeMarketListingPrice(
    payload: { nftContractAddr: string, tokenId: string, newPrice: string }
  ): Promise<{ seller: string, nftID: string, newPrice: string }>;
  cancelMarketListing(payload: { nftContractAddr: string, tokenId: string }): Promise<{ seller: string, nftID: string }>;
  purchaseMarketListing(payload: { nftContractAddr: string, tokenId: string, maxPrice: string }): Promise<{ seller: string, nftID: string, price: string }>;
  fetchSellerOfNft(payload: { nftContractAddr: string, tokenId: string }): Promise<string>;
  fetchTotalShieldSupply(): Promise<number>;
  setupWeaponsWithIdsRenames(weaponIds: string[]): Promise<void>;
  setupCharactersWithIdsRenames(weaponIds: string[]): Promise<void>;
  fetchBoxPrice(): Promise<void>;
}

export default Vue.extend({
  components: { CharacterList, WeaponGrid, Hint, NftList },

  data() {
    return {
      activeType: 'character',
      search: '',
      searchResults: [],
      allSearchResults: [],
      searchResultsOwned: false,
      selectedNftId: null,
      marketOutcome: false,
      marketOutcomeHeading: null,
      marketOutcomeActiveType: null,
      marketOutcomeID: null,
      marketOutcomePrice: null,
      marketOutcomeSeller: null,
      waitingMarketOutcome: false,
      nftPricesById: {},
      characterMarketTax: '',
      weaponMarketTax: '',
      shieldMarketTax: '',
      characterShowLimit: 40,
      weaponShowLimit: 60,
      shieldShowLimit: 60,
      allListingsAmount: 0,
      currentPage: 1,
      browseTabActive: true,
      skillShopTabActive: false,
      listingSellPrice: '',
      priceChangeModal: false,
      weaponTransactionHistoryData: [],
      weaponTransactionHistoryHeader: [],
      characterTransactionHistoryData: [],
      characterTransactionHistoryHeader: [],
      shieldTransactionHistoryData: [],
      shieldTransactionHistoryHeader: [],
      historyCounter: 0,
      isSell: false,
    } as Data;
  },

  computed: {
    ...(mapState([
      'defaultAccount', 'weapons', 'characters', 'shields', 'ownedCharacterIds', 'ownedWeaponIds', 'ownedShieldIds',
    ]) as Accessors<StoreMappedState>),
    ...(mapGetters([
      'contracts', 'ownCharacters', 'totalShieldSupply','getCharacterName','getWeaponName', 'getBoxPrice'
    ]) as Accessors<StoreMappedGetters>),
    ...mapGetters(['transferCooldownOfCharacterId']),

    Weapons(): Contract<Weapons> {
      // we use x! here because we assert that they're set already in created()
      // this helps with typings
      return this.contracts.Weapons!;
    },

    Characters(): Contract<Characters> {
      // we use x! here because we assert that they're set already in created()
      // this helps with typings
      return this.contracts.Characters!;
    },

    Shields(): Contract<Shields> {
      // we use x! here because we assert that they're set already in created()
      // this helps with typings
      return this.contracts.Shields!;
    },

    contractAddress(): string {
      return this.activeType === 'weapon'
        ? this.Weapons.options.address
        : (this.activeType === 'character' ? this.Characters.options.address
          : this.Shields.options.address);
    },

    buyableNftSelected(): boolean {
      return this.selectedNftId !== null
        && !this.searchResultsOwned;
    },

    ownListedNftSelected(): boolean {
      return this.selectedNftId !== null
        && this.searchResultsOwned;
    },

    selectedNftOnCooldown(): boolean {
      return this.selectedNftId !== null
      && (this.activeType === 'weapon' || this.activeType === 'shield'
        ? false
        : (this.transferCooldownOfCharacterId(+this.selectedNftId) > 0));
    },

    canPurchase(): boolean {
      return this.activeType === 'weapon' || this.activeType === 'shield' || this.ownCharacters.length < 8 ;
    },

    specialOffersNftList(): SkillShopListing[] {
      const nftList = [
        {
          id: 'placeholder',
          type: 'shield',
          nftPrice: 3,
          name: 'Shield',
          description: 'A Legendary Defender Shield',
          image: '',
        },
      ] as SkillShopListing[];

      return nftList;
    },
  },

  methods: {
    ...(mapActions([
      'fetchAllMarketNftIds',
      'fetchAllMarketCharacterNftIdsPage',
      'fetchAllMarketWeaponNftIdsPage',
      'fetchAllMarketShieldNftIdsPage',
      'fetchNumberOfWeaponListings',
      'fetchNumberOfCharacterListings',
      'fetchNumberOfShieldListings',
      'fetchMarketNftIdsBySeller',
      'fetchMarketNftPrice',
      'fetchMarketTax',
      'checkMarketItemOwnership',
      'addMarketListing',
      'changeMarketListingPrice',
      'cancelMarketListing',
      'purchaseMarketListing',
      'fetchSellerOfNft',
      'fetchTotalShieldSupply',
      'setupWeaponsWithIdsRenames',
      'setupCharactersWithIdsRenames',
      'fetchBoxPrice'
    ]) as StoreMappedActions),

    clearData() {
      this.activeType = 'weapon';
      this.search = '';
      this.searchResults = [];
      this.allSearchResults = [];
      this.searchResultsOwned = false;
      this.selectedNftId = null;
      this.marketOutcome = false;
      this.waitingMarketOutcome = false;
      this.nftPricesById = {};
      this.allListingsAmount = 0;
      this.currentPage = 1;
      this.listingSellPrice = '';
      this.isSell = false;
    },

    async loadMarketTaxes() {
      if(!this.characterMarketTax) {
        const tax = await this.getMarketTax(this.Characters.options.address) as string;
        this.characterMarketTax = this.convertMarketTax(tax);
      }
      if(!this.weaponMarketTax) {
        const tax = await this.getMarketTax(this.Weapons.options.address) as string;
        this.weaponMarketTax = this.convertMarketTax(tax);
      }
      if(!this.shieldMarketTax) {
        const tax = await this.getMarketTax(this.Shields.options.address) as string;
        this.shieldMarketTax = this.convertMarketTax(tax);
      }
    },

    convertMarketTax(tax: string): string {
      return new BigNumber(tax).div(new BigNumber(2).pow(64)).multipliedBy(100).integerValue(BigNumber.ROUND_CEIL).toString();
    },

    async getMarketTax(contractAddress: string) {
      if(!contractAddress) return;

      return await this.fetchMarketTax({
        nftContractAddr: contractAddress,
      });
    },

    async lookupNftPrice(id: NftId) {
      if(!this.contractAddress) return;

      return await this.fetchMarketNftPrice({
        nftContractAddr: this.contractAddress,
        tokenId: id,
      });
    },

    async fetchNftPrices(nftIds: NftId[]) {
      if(!this.contractAddress) return;
      this.nftPricesById = {};
      await Promise.all(nftIds.map(async id => {
        const price = (await this.lookupNftPrice(id))!;
        void price;
        this.nftPricesById[id] = price;
      }));
    },

    async addListingForNft() {
      this.marketOutcome = true;
      if(this.selectedNftId === null) return;
      if(!this.listingSellPrice) return;

      const val = +this.listingSellPrice;
      if(val <= 0 || !val || isNaN(val)) return;

      this.waitingMarketOutcome = true;
      try {
        const results = await this.addMarketListing({
          nftContractAddr: this.contractAddress,
          // nft-list keys have a typeid format, e.g. shield0
          tokenId: this.activeType === 'weapon' || this.activeType === 'character'
            ? this.selectedNftId
            : this.selectedNftId.split('.')[1],
          price: this.convertSkillToWei(val.toString()),
        });

        this.selectedNftId = null;
        this.waitingMarketOutcome = false;
        this.marketOutcome = true;
        this.marketOutcomeHeading = 'Successfully listed ';
        this.marketOutcomeActiveType = this.activeType;
        this.marketOutcomeID = results.nftID;
        this.marketOutcomePrice = this.convertWeiToSkill(results.price)+' xBlade';
      } catch(error) {
        this.marketOutcome = false;
        this.waitingMarketOutcome = false;
      }
    },

    async updateNftListingPrice() {

      this.marketOutcome = true;
      if(this.selectedNftId === null) return;

      const val = Math.min(+this.listingSellPrice, 10000);
      if(val <= 0 || !val || isNaN(val)) return;

      this.waitingMarketOutcome = true;
      try {
        const results = await this.changeMarketListingPrice({
          nftContractAddr: this.contractAddress,
          tokenId: this.activeType === 'weapon' || this.activeType === 'character'
            ? this.selectedNftId
            : this.selectedNftId.split('.')[1],
          newPrice: this.convertSkillToWei(val.toString())
        });

        this.selectedNftId = null;
        this.waitingMarketOutcome = false;
        this.marketOutcome = true;
        this.marketOutcomeHeading = 'Successfully changed price';
        this.marketOutcomeActiveType = this.activeType;
        this.marketOutcomeID = results.nftID;
        this.marketOutcomePrice = this.convertWeiToSkill(results.newPrice)+' xBlade';
      } catch {
        this.marketOutcome = false;
        this.waitingMarketOutcome = false;
      }
    },

    async purchaseNft() {
      this.marketOutcome = true;
      this.marketOutcomeHeading = null;
      this.marketOutcomeActiveType = null;
      this.marketOutcomeID = null;
      this.marketOutcomePrice = null;
      this.marketOutcomeSeller = null;

      if(this.selectedNftId === null) return;

      const price = await this.lookupNftPrice(this.selectedNftId);
      if(!price) return;

      if(this.activeType !== 'weapon' && this.activeType !== 'character') {
        this.selectedNftId = this.selectedNftId.split('.')[1];
      }

      const skillChainPrice = this.convertStringToDecimal(this.convertWeiToSkill(price), 2);
      const skillUIPrice = this.convertStringToDecimal(this.convertWeiToSkill(this.nftPricesById[this.selectedNftId]), 2);

      if(skillChainPrice !== skillUIPrice) {
        (this as any).$dialog.notify.error('The price of the listing has changed. Please refresh listing and try again');
        return;
      }

      this.waitingMarketOutcome = true;
      try {
        const results: any = await this.purchaseMarketListing({
          nftContractAddr: this.contractAddress,
          tokenId: this.selectedNftId,
          maxPrice: price
        });

        const results2: any  = await this.fetchAllMarketNftIds({
          nftContractAddr: this.contractAddress
        });

        this.allSearchResults = results2;

        this.allSearchResults = Array.from(this.allSearchResults as string[]).filter((x: any) => x.id !== this.selectedNftId);

        this.waitingMarketOutcome = false;
        this.marketOutcome = true;
        this.marketOutcomeHeading = 'Successfully purchased ';
        this.marketOutcomeActiveType = this.activeType;
        this.marketOutcomeID = results.nftID;
        this.marketOutcomePrice = this.convertWeiToSkill(results.price) + ' xBlade';
        this.marketOutcomeSeller = results.seller;
      } catch {
        this.marketOutcome = false;
        this.waitingMarketOutcome = false;
      }
    },

    async cancelNftListing() {
      this.marketOutcome = true;

      if(this.selectedNftId === null) return;

      this.waitingMarketOutcome = true;
      try {
        const results = await this.cancelMarketListing({
          nftContractAddr: this.contractAddress,
          tokenId: this.activeType === 'weapon' || this.activeType === 'character'
            ? this.selectedNftId
            : this.selectedNftId.split('.')[1],
        });

        this.waitingMarketOutcome = false;
        this.marketOutcome = true;
        this.marketOutcomeHeading = 'Successfully taken off the market';
        this.marketOutcomeActiveType = this.activeType;
        this.marketOutcomeID = results.nftID;

        await this.searchOwnListings(this.activeType);
      } catch {
        this.marketOutcome = false;
        this.waitingMarketOutcome = false;
      }
    },

    async searchAllCharacterListings(page: number) {
      this.activeType = 'character';
      this.marketOutcome = true;
      this.waitingMarketOutcome = true;
      this.currentPage = page + 1;

      await this.searchAllCharacterListingsThroughChain(page);


      // searchResultsOwned does not mesh with this function
      // will need per-result checking of it, OR filtering out own NFTs
      //this.searchResultsOwned = nftSeller === this.defaultAccount;
      this.searchResultsOwned = false; // temp

      this.waitingMarketOutcome = false;
      this.marketOutcome = false;
    },

    async searchAllCharacterListingsThroughAPI(page: number) {
      const url = new URL(apiUrl('static/market/character'));
      const params = {
        element: '' + this.characterTraitFilter(),
        minLevel: '' + this.characterMinLevelFilter(),
        maxLevel: '' + this.characterMaxLevelFilter(),
        sortBy: '' + this.characterPriceOrder() ? 'price' : '',
        sortDir: '' + this.characterPriceOrder(),
        minPrice: '' + this.characterMinPriceFilter(),
        maxPrice: '' + this.characterMaxPriceFilter(),
        pageSize: '' + (this.characterShowLimit || defaultLimit),
        pageNum: '' + page,
      };

      url.search = new URLSearchParams(params).toString();

      const charactersData = await fetch(url.toString(),defaultOptions);
      const characters = await charactersData.json();

      this.allListingsAmount = characters.page.total;
      this.allSearchResults = characters.idResults;
    },

    async searchAllCharacterListingsThroughChain(page: number) {
      this.allListingsAmount = await this.fetchNumberOfCharacterListings({
        nftContractAddr: this.contractAddress,
        trait: traitNameToNumber(this.characterTraitFilter()),
        minLevel: this.characterMinLevelFilter(),
        maxLevel: this.characterMaxLevelFilter()
      });


      this.allSearchResults = await this.fetchAllMarketCharacterNftIdsPage({
        nftContractAddr: this.contractAddress,
        limit: this.characterShowLimit || defaultLimit,
        pageNumber: page,
        trait: traitNameToNumber(this.characterTraitFilter()),
        minLevel: this.characterMinLevelFilter(),
        maxLevel: this.characterMaxLevelFilter()
      });


      // filter price character
      this.minPriceFilter(parseFloat(this.characterMinPriceFilter()));
      this.maxPriceFilter(parseFloat(this.characterMaxPriceFilter()));
      this.sortPrice(this.characterPriceOrder());
      // filter price weapon
      this.minPriceFilter(parseFloat(this.weaponMinPriceFilter()));
      this.maxPriceFilter(parseFloat(this.weaponMaxPriceFilter()));
      this.sortPrice(this.weaponPriceOrder());

    },

    async minPriceFilter(minPrice: number){
      // if(minPrice && minPrice > 0){
      //   const arrStr: string[] = [];
      //   this.allSearchResults.forEach((val: any)=>{
      //     if(parseFloat(this.convertWeiToSkill(this.nftPricesById[val])) >= minPrice){
      //       arrStr.push(val);
      //     }
      //   });
      //   this.allSearchResults = arrStr;
      // }
      if(minPrice && minPrice > 0){
        const arrStr: string[] = [];
        const arr = this.allSearchResults;
        this.allSearchResults = [];
        arr.forEach(async (val: any) => {
          const price = (await this.lookupNftPrice(val))!;
          if(parseFloat(this.convertWeiToSkill(price)) >= minPrice){
            arrStr.push(val);
            this.allSearchResults = arrStr;
          }
        });
      }
    },

    async maxPriceFilter(maxPrice: number){
      if(maxPrice && maxPrice > 0){
        const arrStr: string[] = [];
        const arr = this.allSearchResults;
        this.allSearchResults = [];
        arr.forEach(async (val: any) => {
          const price = (await this.lookupNftPrice(val))!;
          if(parseFloat(this.convertWeiToSkill(price)) <= maxPrice){
            arrStr.push(val);
            this.allSearchResults = arrStr;
          }
        });
      }
    },

    sortPrice(typeSort: string){
      if(!typeSort){
        return;
      }
      const sortable: any[] = [];
      this.allSearchResults.forEach((item: any)=>{
        sortable.push([item, this.convertWeiToSkill(this.nftPricesById[item])]);
      });
      if(typeSort === '1'){
        sortable.sort(function(a, b) {
          return parseFloat(a[1]) - parseFloat(b[1]);
        });
      } else if(typeSort === '-1'){
        sortable.sort(function(a, b) {
          return parseFloat(b[1]) - parseFloat(a[1]);
        });
      }

      const result: string[] = [];
      sortable.forEach((item)=>{
        result.push(item[0] as string);
      });

      this.allSearchResults = result;
    },

    async searchAllWeaponListings(page: number) {
      this.activeType = 'weapon';
      this.marketOutcome = true;
      this.waitingMarketOutcome = true;
      this.currentPage = page + 1;
      try {
        if(useBlockchain === true)
          await this.searchAllWeaponListingsThroughChain(page);
        else
          await this.searchAllWeaponListingsThroughAPI(page);

        // searchResultsOwned does not mesh with this function
        // will need per-result checking of it, OR filtering out own NFTs
        //this.searchResultsOwned = nftSeller === this.defaultAccount;
        this.searchResultsOwned = false; // temp
        this.waitingMarketOutcome = false;
        this.marketOutcome = false;
      } catch {
        this.waitingMarketOutcome = false;
        this.marketOutcome = false;
      }
    },

    async searchAllWeaponListingsThroughChain(page: number) {
      const filterStar = this.weaponStarFilter() !== 0 ? this.weaponStarFilter() - 1 : 255;
      this.allListingsAmount = await this.fetchNumberOfWeaponListings({
        nftContractAddr: this.contractAddress,
        trait: traitNameToNumber(this.weaponTraitFilter()),
        stars: filterStar
      });

      this.allSearchResults = await this.fetchAllMarketWeaponNftIdsPage({
        nftContractAddr: this.contractAddress,
        limit: this.weaponShowLimit || defaultLimit,
        pageNumber: page,
        trait: traitNameToNumber(this.weaponTraitFilter()),
        stars: filterStar
      });
    },
    async searchAllWeaponListingsThroughAPI(page: number) {
      const url = new URL(apiUrl('static/market/weapon'));
      const params = {
        element: '' + this.weaponTraitFilter(),
        minStars: '' + this.weaponStarFilter(),
        maxStars: '' + this.weaponStarFilter(),
        sortBy: '' + this.weaponPriceOrder() ? 'price' : '',
        sortDir: '' + this.weaponPriceOrder(),
        minPrice: '' + this.weaponMinPriceFilter(),
        maxPrice: '' + this.weaponMaxPriceFilter(),
        pageSize: '' + (this.weaponShowLimit || defaultLimit),
        pageNum: '' + page,
      };

      url.search = new URLSearchParams(params).toString();
      const weaponsData = await fetch(url.toString(),defaultOptions);
      const weapons = await weaponsData.json();

      this.allListingsAmount = weapons.page.total;
      this.allSearchResults = weapons.idResults;
    },

    async searchAllShieldListings(page: number) {
      this.activeType = 'shield';
      this.marketOutcome = true;
      this.waitingMarketOutcome = true;
      this.currentPage = page + 1;

      if(useBlockchain === true)
        await this.searchAllShieldListingsThroughChain(page);
      else
        await this.searchAllShieldListingsThroughAPI(page);

      // searchResultsOwned does not mesh with this function
      // will need per-result checking of it, OR filtering out own NFTs
      //this.searchResultsOwned = nftSeller === this.defaultAccount;
      this.searchResultsOwned = false; // temp

      this.waitingMarketOutcome = false;
      this.marketOutcome = false;
    },

    async searchAllShieldListingsThroughChain(page: number) {
      const filterStar = this.nftStarFilter() !== 0 ? this.nftStarFilter() - 1 : 255;
      this.allListingsAmount = await this.fetchNumberOfShieldListings({
        nftContractAddr: this.contractAddress,
        trait: traitNameToNumber(this.nftTraitFilter()),
        stars: filterStar
      });

      this.allSearchResults = await this.fetchAllMarketShieldNftIdsPage({
        nftContractAddr: this.contractAddress,
        limit: this.shieldShowLimit || defaultLimit,
        pageNumber: page,
        trait: traitNameToNumber(this.nftTraitFilter()),
        stars: filterStar
      });
    },

    async searchAllShieldListingsThroughAPI(page: number) {
      const url = new URL(apiUrl('static/market/shield'));
      const params = {
        element: '' + this.nftTraitFilter(),
        minStars: '' + this.nftStarFilter(),
        maxStars: '' + this.nftStarFilter(),
        sortBy: '' + this.nftPriceOrder() ? 'price' : '',
        sortDir: '' + this.nftPriceOrder(),
        pageSize: '' + (this.shieldShowLimit || defaultLimit),
        pageNum: '' + page,
      };

      url.search = new URLSearchParams(params).toString();

      const shieldsData = await fetch(url.toString(),defaultOptions);
      const shields = await shieldsData.json();

      this.allListingsAmount = shields.page.total;
      this.allSearchResults = shields.idResults;
    },

    async searchListingsByNftId(type: SellType) {
      this.activeType = type;
      this.marketOutcome = true;
      this.waitingMarketOutcome = true;

      const nftSeller = await this.fetchSellerOfNft({
        nftContractAddr: this.contractAddress,
        tokenId: this.search
      });
      this.searchResultsOwned = nftSeller === this.defaultAccount;
      // const url = new URL('https://xblades.herokuapp.com/static/wallet/banned/' + nftSeller);
      // const data = await fetch(url.toString(),defaultOptions);
      // const banned = await data.json();
      // if(banned.banned) {
      //   (this as any).$dialog.notify.error('Item not available!');
      // }

      const price = await this.lookupNftPrice(this.search);
      if(price !== '0' /* && !banned.banned */) {
        this.searchResults = [this.search];
      } else {
        this.searchResults = [];
      }

      this.waitingMarketOutcome = false;
      this.marketOutcome = false;
    },

    async searchListingsBySeller(type: SellType) {
      this.activeType = type;
      this.marketOutcome = true;
      this.waitingMarketOutcome = true;

      try {
        if(useBlockchain){
          await this.searchListingsBySellerThroughChain();
        }
        else {
          await this.searchListingsBySellerThroughAPI();
        }
      } catch {
        this.searchResultsOwned = false;
        this.waitingMarketOutcome = false;
        this.marketOutcome = false;
        this.searchResults = [];
      }

      this.waitingMarketOutcome = false;
      this.marketOutcome = false;
    },

    async searchListingsBySellerThroughChain(){
      this.searchResults = await this.fetchMarketNftIdsBySeller({
        nftContractAddr: this.contractAddress,
        sellerAddr: this.search
      });

      this.searchResultsOwned = this.search === this.defaultAccount;
    },

    async searchListingsBySellerThroughAPI(){
      this.searchResults = this.activeType === 'weapon' ?
        await this.searchWeaponListingsBySeller(this.search)
        : (this.activeType === 'character' ?
          await this.searchCharacterListingsBySeller(this.search)
          : await this.searchShieldListingsBySeller(this.search));

      this.searchResultsOwned = false;
    },
    async searchOwnListings(type: SellType) {
      this.marketOutcome = true;
      this.activeType = type;
      if(!this.defaultAccount) {
        this.searchResults = [];
        return;
      }
      this.waitingMarketOutcome = true;

      try {
        await this.searchOwnListingsThroughChain();

        this.searchResultsOwned = true;
        this.waitingMarketOutcome = false;
        this.marketOutcome = false;
      } catch {
        this.waitingMarketOutcome = false;
        this.marketOutcome = false;
      }
    },

    async searchOwnListingsThroughChain() {
      this.searchResults = await this.fetchMarketNftIdsBySeller({
        nftContractAddr: this.contractAddress,
        sellerAddr: this.defaultAccount as string
      });
    },

    async searchCharacterListingsBySeller(sellerAddress: string): Promise<string[]>{
      const url = new URL(apiUrl('static/market/character'));
      const params = {
        element: '' + this.characterTraitFilter(),
        minLevel: '' + this.characterMinLevelFilter(),
        maxLevel: '' + this.characterMaxLevelFilter(),
        sortBy: '' + this.characterPriceOrder() ? 'price' : '',
        minPrice: '' + this.characterMinPriceFilter(),
        maxPrice: '' + this.characterMaxPriceFilter(),
        sortDir: '' + this.characterPriceOrder(),
        sellerAddress: '' + sellerAddress,
      };

      url.search = new URLSearchParams(params).toString();

      const charactersData = await fetch(url.toString(),defaultOptions);
      const characters = await charactersData.json();
      return characters.idResults;
    },

    async searchWeaponListingsBySeller(sellerAddress: string): Promise<string[]>{
      const url = new URL(apiUrl('static/market/weapon'));
      const params = {
        element: '' + this.weaponTraitFilter(),
        minStars: '' + this.weaponStarFilter(),
        maxStars: '' + this.weaponStarFilter(),
        sortBy: '' + this.weaponPriceOrder() ? 'price' : '',
        sortDir: '' + this.weaponPriceOrder(),
        minPrice: '' + this.weaponMinPriceFilter(),
        maxPrice: '' + this.weaponMaxPriceFilter(),
        pageSize: '' + (this.weaponShowLimit || defaultLimit),
        sellerAddress: '' + sellerAddress,
      };

      url.search = new URLSearchParams(params).toString();

      const weaponsData = await fetch(url.toString(),defaultOptions);
      const weapons = await weaponsData.json();
      return weapons.idResults;
    },

    async searchShieldListingsBySeller(sellerAddress: string): Promise<NftIdType[]>{
      const url = new URL(apiUrl('static/market/shield'));
      const params = {
        element: '' + this.nftTraitFilter(),
        minStars: '' + this.nftStarFilter(),
        maxStars: '' + this.nftStarFilter(),
        sortBy: '' + this.nftPriceOrder() ? 'price' : '',
        sortDir: '' + this.nftPriceOrder(),
        pageSize: '' + (this.shieldShowLimit || defaultLimit),
        sellerAddress: '' + sellerAddress,
      };

      url.search = new URLSearchParams(params).toString();

      const shieldsData = await fetch(url.toString(),defaultOptions);
      const shields = await shieldsData.json();
      return shields.idResults;
    },

    async searchItemsSoldBySeller(sellerAddress: string): Promise<any[]>{
      const url = new URL(apiUrl(`static/market/transactions/${sellerAddress}`));

      const weaponsData = await fetch(url.toString(),defaultOptions);
      const weapons = await weaponsData.json();
      return weapons.results;
    },

    async showWeaponsSoldModal() {
      const weaponHistory: IWeaponHistory[] = await this.searchItemsSoldBySeller(this.defaultAccount as string);
      this.weaponTransactionHistoryHeader = [
        {
          key: 'weaponId',
          sortable: true,
          label: 'Weapon ID'
        },
        {
          key: 'weaponName',
          sortable: true,
          label: 'Name'
        },
        {
          key: 'weaponPrice',
          label: 'Price',
          sortable: true,
        }
      ];

      this.characterTransactionHistoryHeader = [
        {
          key: 'charId',
          sortable: true,
          label: 'Character ID'
        },
        {
          key: 'charName',
          sortable: true,
          label: 'Name'
        },
        {
          key: 'charPrice',
          label: 'Price',
          sortable: true,
        }
      ];
      if(weaponHistory.length === 0){
        this.historyCounter = 0;
      }
      else{
        this.historyCounter = weaponHistory.length;
        for (let i = 0; i<weaponHistory.length; ++i){
          if(weaponHistory[i].type === 'weapon' && weaponHistory !== undefined){
            // eslint-disable-next-line prefer-const
            let items: WeaponTransactionHistoryData = {
              weaponId: weaponHistory[i].weaponId,
              weaponName: getCleanName(this.getWeaponName(weaponHistory[i].weaponId, weaponHistory[i].weaponStars)),
              weaponPrice: weaponHistory[i].price
            };

            this.weaponTransactionHistoryData.push(items);
          }
        }
      }

      (this.$refs['weapons-sold-modal'] as BModal).show();
    },
    async showCharactersSoldModal() {
      const characterHistory: ICharacterHistory[] = await this.searchItemsSoldBySeller(this.defaultAccount as string);
      this.characterTransactionHistoryHeader = [
        {
          key: 'charId',
          sortable: true,
          label: 'Character ID'
        },
        {
          key: 'charName',
          sortable: true,
          label: 'Name'
        },
        {
          key: 'charPrice',
          label: 'Price',
          sortable: true,
        }
      ];
      if(characterHistory.length === 0){
        this.historyCounter = 0;
      }
      else{
        this.historyCounter = characterHistory.length;
        for (let i = 0; i<characterHistory.length; ++i){

          if(characterHistory[i].type === 'character' && characterHistory !== undefined){
            // eslint-disable-next-line prefer-const
            let items: CharacterTransactionHistoryData = {
              charId: characterHistory[i].charId,
              charName: getCleanName(this.getCharacterName(characterHistory[i].charId)),
              charPrice: characterHistory[i].price
            };

            this.characterTransactionHistoryData.push(items);
          }
        }
      }

      (this.$refs['characters-sold-modal'] as BModal).show();
    },
    async showShieldsSoldModal() {
      const shieldHistory: IShieldHistory[] = await this.searchItemsSoldBySeller(this.defaultAccount as string);
      this.shieldTransactionHistoryHeader = [
        {
          key: 'shieldId',
          sortable: true,
          label: 'Shield ID'
        },
        {
          key: 'shieldName',
          sortable: true,
          label: 'Name'
        },
        {
          key: 'shieldPrice',
          label: 'Price',
          sortable: true,
        }
      ];

      if(shieldHistory.length === 0){
        this.historyCounter = 0;
      }
      else{
        this.historyCounter = shieldHistory.length;
        for (let i = 0; i<shieldHistory.length; ++i){
          if(shieldHistory[i].type === 'shield' && shieldHistory !== undefined){
            // eslint-disable-next-line prefer-const
            let items: ShieldTransactionHistoryData = {
              shieldId: shieldHistory[i].shieldId,
              shieldName: getShieldNameFromSeed(parseInt(shieldHistory[i].shieldId,10),shieldHistory[i].shieldStars),
              shieldPrice: shieldHistory[i].price
            };

            this.shieldTransactionHistoryData.push(items);
          }
        }
      }

      (this.$refs['shields-sold-modal'] as BModal).show();
    },


    resetTransactionHistoryValues(modalName: string){
      this.characterTransactionHistoryData = [];
      this.weaponTransactionHistoryData = [];
      this.shieldTransactionHistoryData = [];
      (this.$refs[modalName] as BModal).hide();
    },

    showListingSetupModal(changingPrice: boolean = false) {
      this.clearInputs();
      this.priceChangeModal = changingPrice;
      (this.$refs['listing-setup-modal'] as BModal).show();
    },

    clearInputs() {
      this.listingSellPrice = '';
    },

    convertWeiToSkill(wei: string) {
      return fromWeiEther(wei);
    },
    convertSkillToWei(skill: string) {
      return Web3.utils.toWei(skill);
    },

    characterMinLevelFilter(): number {
      return sessionStorage.getItem('character-levelfilter') ? +(sessionStorage.getItem('character-levelfilter') as string) - 1 : 0;
    },

    characterMaxLevelFilter(): number {
      return sessionStorage.getItem('character-levelfilter') ? +(sessionStorage.getItem('character-levelfilter') as string) + 8 : 255;
    },

    characterTraitFilter(): string {
      return sessionStorage.getItem('character-elementfilter') ? (sessionStorage.getItem('character-elementfilter') as string).toLowerCase() : '';
    },

    characterPriceOrder(): string {
      return sessionStorage.getItem('character-price-order') ? (sessionStorage.getItem('character-price-order') as string) : '';
    },

    characterMinPriceFilter(): string {
      return sessionStorage.getItem('character-price-minfilter') ? (sessionStorage.getItem('character-price-minfilter') as string) : '';
    },
    characterMaxPriceFilter(): string {
      return sessionStorage.getItem('character-price-maxfilter') ? (sessionStorage.getItem('character-price-maxfilter') as string) : '';
    },

    weaponTraitFilter(): string {
      return sessionStorage.getItem('market-weapon-elementfilter') ? (sessionStorage.getItem('market-weapon-elementfilter') as string).toLowerCase() : '';
    },

    weaponStarFilter(): number {
      return sessionStorage.getItem('market-weapon-starfilter') ? +(sessionStorage.getItem('market-weapon-starfilter') as string) : 0;
    },

    weaponPriceOrder(): string {
      return sessionStorage.getItem('market-weapon-price-order') ? (sessionStorage.getItem('market-weapon-price-order') as string) : '';
    },

    weaponMinPriceFilter(): string {
      return sessionStorage.getItem('market-weapon-price-minfilter') ? (sessionStorage.getItem('market-weapon-price-minfilter') as string) : '';
    },
    weaponMaxPriceFilter(): string {
      return sessionStorage.getItem('market-weapon-price-maxfilter') ? (sessionStorage.getItem('market-weapon-price-maxfilter') as string) : '';
    },

    nftTypeFilter(): string {
      return sessionStorage.getItem('market-nft-elementfilter') ? (sessionStorage.getItem('market-nft-elementfilter') as string).toLowerCase() : '';    },

    nftTraitFilter(): string {
      return sessionStorage.getItem('market-nft-elementfilter') ? (sessionStorage.getItem('market-nft-elementfilter') as string).toLowerCase() : '';
    },

    nftStarFilter(): number {
      return sessionStorage.getItem('market-nft-starfilter') ? +(sessionStorage.getItem('market-nft-starfilter') as string) : 0;
    },

    nftPriceOrder(): string {
      return sessionStorage.getItem('market-nft-price-order') ? (sessionStorage.getItem('market-nft-price-order') as string) : '';
    },

    convertStringToDecimal(val: string, maxDecimals: number) {
      return new BigNumber(val).toFixed(maxDecimals);
    },
    activeListingMarketTax(): string{
      if(this.activeType === 'weapon'){
        return this.weaponMarketTax;
      }

      if(this.activeType === 'character'){
        return this.characterMarketTax;
      }

      if(this.activeType === 'shield'){
        return this.shieldMarketTax;
      }

      return '0';
    },

    calculatedBuyerCost(listedPrice: number): string {
      return (0.01 * listedPrice * (100 + parseFloat(this.activeListingMarketTax()))).toFixed(8).replace(/(\.0+|0+)$/, '');
    },

    maxPrecisionSkill(listedPrice: string): string {
      return this.convertStringToDecimal(this.convertWeiToSkill(listedPrice), 8);
    }
  },

  watch: {

    async searchResults(nftIds: CharacterId[] | WeaponId[] | ShieldId[]) {
      this.selectedNftId = null;
      await this.fetchNftPrices(nftIds);
      if(this.activeType === 'weapon') {
        await this.setupWeaponsWithIdsRenames(nftIds);
      } else if(this.activeType === 'character') {
        await this.setupCharactersWithIdsRenames(nftIds);
      }
    },

    async allSearchResults(nftIds: CharacterId[] | WeaponId[] | ShieldId[]) {
      this.selectedNftId = null;
      await this.fetchNftPrices(nftIds);
      if(this.activeType === 'weapon') {
        await this.setupWeaponsWithIdsRenames(nftIds);
      } else if(this.activeType === 'character') {
        await this.setupCharactersWithIdsRenames(nftIds);
      }
    }
  },

  filters: {
    maxDecimals(val: string, maxDecimals: number) {
      return new BigNumber(val).toFixed(maxDecimals);
    },
    dynamicDecimals(val: string, minDecimals: number, maxDecimals: number) {
      const parsedVal = new BigNumber(val);

      if(parsedVal < new BigNumber(Math.pow(10, -maxDecimals))){
        return '< ' + Math.pow(10, -maxDecimals).toFixed(maxDecimals);
      }

      for(let i = maxDecimals - 1; i >= minDecimals; i--){
        if(parsedVal < new BigNumber(Math.pow(10, -i))){
          return new BigNumber(val).toFixed(i + 1);
        }
      }

      return new BigNumber(val).toFixed(minDecimals);
    }
  },

  async mounted() {
    assert.ok(this.contracts.Weapons && this.contracts.Characters && this.contracts.Shields, 'Expected required contracts to be available');
    this.searchAllCharacterListings(0);
    await this.fetchBoxPrice();
  },
});
</script>

<style scoped>
.body {
  margin-top: 3px;
}

.button + .button {
  margin-left: 10px;
}

.search {
  width: 100%;
}

.search-buttons, .self-buttons {
  margin-top: 10px;
  display: flex;
  justify-content: space-around;
}

.result-weaponHistory {
  max-width: 12em;
}

.result-selected {
  outline: solid currentcolor 2px;
}

.sell-grid {
  /* display: flex;
  justify-content: center;
  flex-direction: column; */
}

.outcome {
  margin: auto;
  text-align: center;
  font-size: 1em;
}

.modal-input {
  margin-bottom: 5px;
  margin-top: 5px;
}

.disabled-button {
  opacity: 0.65;
}

.transaction-history-text{
  color: #9e8a57 !important;
}

.transaction-history-header-text{
   color: #9e8a57;
  font-size: 34px;
}
.m-top-negative-5{
  margin-top: -5px;
}

.centered-text {
  text-align: center;
  padding: 10px;
}

.shop-horizontal-divider-top {
  margin-top: -10px;
  height: fit-content;
  width: 100%;
}

.shop-horizontal-divider {
  width: 100%;
}

.special-offer-items {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.shop-items {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.special-offer-bg {
  margin-top: -5px;
}

.weapon {
  flex-direction: column;
}

/* .price{
  margin-top: 65px;
} */

.btn-purchase{
  background: url("../assets/v2/shop_nft_btn.svg");
  background-repeat: no-repeat;
  background-size: contain;
  box-shadow: none;
  width: 170px;
  height: 40px;
  margin: auto;
  margin-top: 60px;
  border: none;
  color: white;
  font-weight: 800;
  display: flex;
  justify-content: center;
  align-items: center;
}

.value-price{
  font-size: 14px;
}

.value-price span{
  font-size: 20px;
  color: rgb(216,88,247);
  font-weight: 800;
}

.button-row{
  flex-direction: column;
  align-items: center;
  background-color: rgba(0, 0, 0, .5);
  padding: 60px 30px;
}

.button-row > div{
  width: 100%;
  padding: 0 20px;
}

.gtag-link-others{
  border: none;
  padding: 10px 20px;
  margin-bottom: 15px;
}

.search-btn{
  background-color: rgb(175,175,175);
  border-radius: 10px;
}

.search-btn:hover{
  background-color: rgb(245,139,91);
}

.form-control{
  background-color: transparent;
  border: 1px solid rgb(17,65,105);
  margin-bottom: 50px;
  border-radius: 10px;
  padding: 15px 20px;
  color: white
}

.form-control::placeholder{
  color: rgba(255, 255, 255, .8);
}

.form-control:focus{
  background-color: transparent;
  color: white;
}

.market-hero-weapon{
  position: relative;
  /* top: -42.515px; */
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  margin-left: 8px;
  margin-bottom: 50px;
}
.market-hero-weapon::before{
  content: "";
  position: absolute;
  bottom: 0;
  background-color: rgb(245,139,91);
  height: 5px;
  width: 100%;
}

.market-hero-weapon button{
  width: 18%;
  height: 46px;
  font-size: 20px;
  cursor: pointer;
  background-color: transparent;
  color: white;
  border: none;
  text-align: center;
}


.market-hero-weapon button.selected{
  background-color: rgb(245,139,91);
}

@media (max-width: 1200px){
  .market-hero-weapon button{
    width: 30%;
  }
}

@media (max-width: 993px){
  .market-hero-weapon button{
    width: 35%;
  }
}

@media (max-width: 767px){
  .market-hero-weapon button{
    width: 40%;
  }
  .body {
    margin-top: 3px;
    padding: 0 20px;
  }
}

@media (max-width: 575.98px) {
  .body {
    margin-top: 3px;
    padding: 0 10px;
  }
  .market-hero-weapon button{
    width: 50%;
  }
}

</style>
