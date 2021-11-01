<template>
  <b-navbar-nav>

    <router-link :to="{ name: 'plaza' }" exact class="nav-link"
    v-if="!featureFlagStakeOnly">
      <li class="nav-item nav-top-links">
        <span class="gtag-link-others" tagname="plaza_screen">Plaza</span>
      </li>
    </router-link>

    <router-link :to="{ name: 'blacksmith' }" exact class="nav-link"   v-if="!featureFlagStakeOnly">
      <li class="nav-item nav-top-links" >
        <span class="gtag-link-others" tagname="blacksmith_screen">Inventory</span>
      </li>
    </router-link>

    <router-link :to="{ name: 'combat' }" exact class="nav-link"  v-if="!featureFlagStakeOnly">
      <li class="nav-item nav-top-links" >
        <span class="gtag-link-others" tagname="combat_screen">Combat</span>
      </li>
    </router-link>

    <router-link :to="{ name: 'raid' }" exact class="nav-link"  v-if="!featureFlagStakeOnly && featureFlagRaid">
      <li class="nav-item nav-top-links">
        <span class="gtag-link-others" tagname="raid_screen">Raid</span>
      </li>
    </router-link>

    <router-link :to="{ name: 'market' }" exact class="nav-link" v-if="!featureFlagStakeOnly && featureFlagMarket">
      <li class="nav-item nav-top-links">
        <span class="gtag-link-others" tagname="market_screen">Market</span>
      </li>
    </router-link>

    <!-- <router-link :to="{ name: 'select-stake-type' }" exact class="nav-link">
      <li class="nav-item nav-top-links">
        <span class="gtag-link-others" tagname="stake_screen">Stake</span>
      </li>
    </router-link> -->

    <router-link :to="{ name: 'shop' }" exact class="nav-link">
      <li class="nav-item nav-top-links">
        <span class="gtag-link-others" tagname="shop_screen">Shop</span>
      </li>
    </router-link>

    <div exact class="nav-link">
      <li class="nav-item nav-top-links">
        <a href="https://www.cryptowar.network/buy" target="_blank" class="gtag-link-others" tagname="shop_screen">Buy IDO</a>
      </li>
    </div>

    <router-link :to="{ name: 'referral' }" exact class="nav-link">
      <li class="nav-item nav-top-links">
        <span class="gtag-link-others" tagname="referral_screen">Referral</span>
      </li>
    </router-link>

  </b-navbar-nav>
</template>

<script>
import { market as featureFlagMarket, portal as featureFlagPortal } from '../feature-flags';

export default {
  inject: ['featureFlagStakeOnly', 'featureFlagRaid'],

  computed: {
    featureFlagMarket() {
      return featureFlagMarket;
    },
    featureFlagPortal() {
      return featureFlagPortal;
    }
  },
};
</script>

<style scoped>
a {
  font-weight: bold;
  color: #ffffff;
}
a:hover {
  color: #F58B5B;
}

.nav-top-links > span {
  color : #ffffff;
  font-size: 1.1em;
  padding: 0px 5px 0px 5px;
}
</style>
