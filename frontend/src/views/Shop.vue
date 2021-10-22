<template>
  <div class="body main-font">
    <div class="shop-items">
      <nft-list :isShop="true" :nftIdTypes="itemRender" />
    </div>
  </div>
</template>

<script lang="ts">
import Vue from "vue";
import Web3 from "web3";
import { mapActions, mapGetters, mapState } from "vuex";
import { Accessors } from "vue/types/options";
import { Contracts, IState } from "../interfaces";
import { SkillShopListing } from "../interfaces/SkillShopListing";
import BigNumber from "bignumber.js";
import { fromWeiEther, toBN } from "../utils/common";
import NftList from "@/components/smart/NftList.vue";

type StoreMappedState = Pick<
IState,
| "defaultAccount"
| "weapons"
| "characters"
| "shields"
| "ownedCharacterIds"
| "ownedWeaponIds"
| "ownedShieldIds"
>;

interface StoreMappedGetters {
  contracts: Contracts;
  ownCharacters: any[];
  totalShieldSupply: 0;
  getCharacterName(id: string): string;
  getWeaponName(id: string, stars: number): string;
  getBoxPrice(): { common: string; rare: string };
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
  fetchBoxPrice(): Promise<void>;
  fetchTotalCommonBoxSupply(): Promise<number>;
  fetchTotalRareBoxSupply(): Promise<number>;
}

export default Vue.extend({
  components: { NftList },
  data() {
    return {
      fetchBoxPriceInterval: 0,
      fetchCommonBoxSupplyInterval: 0,
      fetchRareBoxSupplyInterval: 0,
      commonBoxSupply: 0,
      rareBoxSupply: 0
    };
  },
  computed: {
    ...(mapState([
      "defaultAccount",
      "weapons",
      "characters",
      "shields",
      "ownedCharacterIds",
      "ownedWeaponIds",
      "ownedShieldIds",
    ]) as Accessors<StoreMappedState>),
    ...(mapGetters([
      "contracts",
      "ownCharacters",
      "totalShieldSupply",
      "getCharacterName",
      "getWeaponName",
      "getBoxPrice",
    ]) as Accessors<StoreMappedGetters>),
    ...mapGetters(["transferCooldownOfCharacterId"]),

    specialOffersNftList(): SkillShopListing[] {
      const nftList = [
        {
          id: "placeholder",
          type: "shield",
          nftPrice: 3,
          name: "Shield",
          description: "A Legendary Defender Shield",
          image: "",
        },
      ] as SkillShopListing[];

      return nftList;
    },

    shopOffersNftList(): SkillShopListing[] {
      const { common, rare } = this.getBoxPrice();

      const nftList = [
        {
          id: 0,
          type: "SecretBox",
          nftPrice: toBN(fromWeiEther(common)).toNumber(),
          name: "Common Box",
          description: "Get common weapon, 1% chance to get 5-stars weapon",
          image: "common-box.png",
          isSoldOut: Number(this.commonBoxSupply) === 0,
          supply: this.commonBoxSupply
        },
        {
          id: 1,
          type: "SecretBox",
          nftPrice: toBN(fromWeiEther(rare)).toNumber(),
          name: "Rare Box",
          description: "Get rare weapon, 4% chance to get 5-stars weapon",
          image: "rare-box.png",
          isSoldOut: Number(this.rareBoxSupply) === 0,
          supply: this.rareBoxSupply
        },
        {
          id: 2,
          type: "SecretBox",
          nftPrice: 0,
          name: "Epic Box",
          description: "Get epic weapon, 6% chance to get 5-stars weapon",
          image: "epic-box.png",
          isSoldOut: true,
          supply: 0
        },
      ] as SkillShopListing[];

      return nftList;
    },

    itemRender(): SkillShopListing[] {
      return this.shopOffersNftList;
    },
  },

  methods: {
    ...(mapActions(["fetchBoxPrice", 'fetchTotalRareBoxSupply','fetchTotalCommonBoxSupply']) as StoreMappedActions),
    convertWeiToSkill(wei: string) {
      return fromWeiEther(wei);
    },
    convertSkillToWei(skill: string) {
      return Web3.utils.toWei(skill);
    },
  },

  filters: {
    maxDecimals(val: string, maxDecimals: number) {
      return new BigNumber(val).toFixed(maxDecimals);
    },
    dynamicDecimals(val: string, minDecimals: number, maxDecimals: number) {
      const parsedVal = new BigNumber(val);

      if (parsedVal < new BigNumber(Math.pow(10, -maxDecimals))) {
        return "< " + Math.pow(10, -maxDecimals).toFixed(maxDecimals);
      }

      for (let i = maxDecimals - 1; i >= minDecimals; i--) {
        if (parsedVal < new BigNumber(Math.pow(10, -i))) {
          return new BigNumber(val).toFixed(i + 1);
        }
      }

      return new BigNumber(val).toFixed(minDecimals);
    },
  },

  async mounted() {
    // @ts-ignore
    this.fetchBoxPriceInterval = setInterval(() => {
      this.fetchBoxPrice();
    }, 3000);
    // @ts-ignore
    this.fetchCommonBoxSupplyInterval = setInterval(async () => {
      this.commonBoxSupply = await this.fetchTotalCommonBoxSupply();
    }, 3000);
    // @ts-ignore
    this.fetchRareBoxSupplyInterval = setInterval(async () => {
      this.rareBoxSupply = await this.fetchTotalRareBoxSupply();
    }, 3000);
  },
  beforeDestroy() {
    clearInterval(this.fetchBoxPriceInterval);
    clearInterval(this.fetchCommonBoxSupplyInterval);
    clearInterval(this.fetchRareBoxSupplyInterval);
  },
});
</script>

<style scoped>
.body {
  margin-top: 10px;
}

.button + .button {
  margin-left: 10px;
}

.search {
  width: 100%;
}

.search-buttons,
.self-buttons {
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
  display: flex;
  justify-content: center;
  flex-direction: column;
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

.transaction-history-text {
  color: #9e8a57 !important;
}

.transaction-history-header-text {
  color: #9e8a57;
  font-size: 34px;
}
.m-top-negative-5 {
  margin-top: -5px;
}

.m-top-negative-50 {
  margin-top: -50px;
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
.button-row {
  align-items: center;
  justify-content: center;
}
.buttons-row {
  text-align: center;
  justify-content: center;
}
</style>
