import VueRouter, { RouteConfig } from 'vue-router';

import Plaza from './views/Plaza.vue';
import Blacksmith from './views/Blacksmith.vue';
import Combat from './views/Combat.vue';
import Stake from './views/Stake.vue';
import SelectStakeType from './views/SelectStakeType.vue';
import Raid from './views/Raid.vue';
import Market from './views/Market.vue';
import Leaderboard from './views/Leaderboard.vue';
import Options from './views/Options.vue';
import Shop from './views/Shop.vue';
import Referral from './views/Referral.vue';

import {
  raid as featureFlagRaid,
  stakeOnly as featureFlagStakeOnly,
  market as featureFlagMarket,
} from './feature-flags';

function createRouter() {
  if (featureFlagStakeOnly) {
    return new VueRouter({
      routes: [
        { path: '/', redirect: 'stake' },
        { path: '/stake', name: 'select-stake-type', component: SelectStakeType },
        { path: '/stake/:stakeType', name: 'stake', component: Stake, props: true },
      ]
    });
  }

  let marketRoutes: RouteConfig[] = [];
  if(featureFlagMarket) {
    marketRoutes = [
      { path: '/market', name: 'market', component: Market }
    ];
  }

  const router = new VueRouter({
    routes: [
      { path: '/', name: 'plaza', component: Plaza },
      { path: '/blacksmith', name: 'blacksmith', component: Blacksmith },
      { path: '/combat', name: 'combat', component: Combat },
      { path: '/leaderboard', name: 'leaderboard', component: Leaderboard },
      ...marketRoutes,
      // { path: '/stake', name: 'select-stake-type', component: SelectStakeType },
      // { path: '/stake/:stakeType', name: 'stake', component: Stake, props: true },
      { path: '/options', name: 'options', component: Options },
      { path: '/shop', name: 'shop', component: Shop },
      { path: '/referral', name: 'referral', component: Referral}
    ]
  });

  if(featureFlagRaid) {
    router.addRoute({ path: '/raid/', name: 'raid', component: Raid });
  }


  return router;
}

export default createRouter;
