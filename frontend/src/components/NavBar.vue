<template>
  <div class="main-nav-div">
    <div
      v-if="referralAddress"
      style="
        color: #7f327c;
        text-align: center;
        background: white;
        padding: 10px;
      "
    >
      ✨ Congratulations! You get 7% discount when mint new heroes ⚔️ only valid
      in 24 hours ⏰
    </div>
    <b-navbar class="main-nav" toggleable="sm">
      <router-link :to="{ name: 'plaza' }" exact>
        <b-navbar-brand class="nav-logo">
          <img
            src="../assets/logo250.png"
            class="logo d-inline-block align-top"
            alt="Logo"
          />
        </b-navbar-brand>
      </router-link>

      <view-links class="view-links desktop"></view-links>

      <skill-balance-display
        class="ml-auto d-none d-sm-flex skill-balance-display"
      />

      <!-- <claim-rewards class="claim-rewards" v-if="!canShowRewardsBar" /> -->

      <options class="d-none d-sm-flex option-desktop" />

      <!-- Render only on mobile view -->
      <div
        class="d-flex justify-content-between align-items-center option-mobile"
      >
        <!-- <skill-balance-display class="skill-display-mobile" /> -->
        <b-navbar-brand href="/" class="nav-logo-mobile">
          <img
            src="../assets/logo250.png"
            class="logo d-inline-block align-top"
            alt="Logo"
          />
        </b-navbar-brand>
        <div class="option-container-mobile">
          <label for="input__modal__id">
            <i class="fa fa-bars"></i>
          </label>
          <input
            type="checkbox"
            class="input__modal"
            id="input__modal__id"
            :checked="checkCloseOption"
          />
          <div class="modal">
            <label for="input__modal__id" class="modal__overlay"></label>
          </div>
          <div class="modal__body">
            <options class="options-display-mobile" />
          </div>
        </div>
      </div>
    </b-navbar>
    <div class="nav-bottom-line"></div>
    <div class="container_row notice-headline">
      <p>
        Greeting everyone, we want to announce that Cryptowar will be discontinued after
        <span>06/06/2022</span>
      </p>
    </div>
    <div class="nav-bottom-line"></div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'

import ViewLinks from './ViewLinks.vue'
import Options from './Options.vue'
import SkillBalanceDisplay from './smart/SkillBalanceDisplay.vue'
// import ClaimRewards from "./smart/ClaimRewards.vue";
// import OptionsMobile from "./OptionsMobile.vue";

import Events from '../events'
import { mapGetters, mapMutations } from 'vuex'

export default Vue.extend({
  components: {
    ViewLinks,
    SkillBalanceDisplay,
    // ClaimRewards,
    Options,
    // OptionsMobile,
  },

  data() {
    return {
      checkCloseOption: '',
      // canShowRewardsBar: true,
    }
  },

  computed: {
    ...mapGetters([
      'getIsCharacterViewExpanded',
      'ownCharacters',
      'defaultAccount',
    ]),
    referralAddress(): string {
      // @ts-ignore
      const referralAddress = this.$route.query.r
      if (referralAddress && referralAddress !== this.defaultAccount) {
        return referralAddress
      }
      return ''
    },
  },

  methods: {
    ...mapMutations(['setIsCharacterViewExpanded']),
    // checkStorage(): void {
    //   this.canShowRewardsBar = localStorage.getItem("hideRewards") === "false";
    // },
    toggleCharacterView(): void {
      this.setIsCharacterViewExpanded(!this.getIsCharacterViewExpanded)
      localStorage.setItem(
        'isCharacterViewExpanded',
        this.getIsCharacterViewExpanded ? 'true' : 'false'
      )
    },
  },

  updated() {
    this.checkCloseOption = ''
  },

  mounted() {
    Events.$on('hide-option', (i: any) => {
      this.checkCloseOption = i
    })
    // this.checkStorage();
    // Events.$on("setting:hideRewards", () => this.checkStorage());
  },
})
</script>

<style>
.main-nav-div {
  position: fixed;
  top: 0;
  width: 100%;
  z-index: 1001;
}
/** Suggest to move this to atomic folder structure like assets/css **/
a {
  text-decoration: none;
  user-select: none;
}

.dropdown-menu {
  background: rgb(20, 20, 20);
  background: linear-gradient(
    45deg,
    rgba(20, 20, 20, 1) 0%,
    rgba(36, 39, 32, 1) 100%
  );
  border: none !important;
}

.dropdown-menu li a:hover {
  background: transparent !important;
}

@media (max-width: 1400px) {
  .main-nav {
    align-items: normal !important; /** force only for mobile to manually set alignments **/
    flex-direction: column;
  }
  .main-nav > .navbar-brand {
    align-self: center;
  }
  .main-nav > .navbar-nav {
    flex-direction: row;
    justify-content: space-evenly;
    flex-wrap: wrap;
  }
  .skill-display-mobile {
    flex: 5;
  }
  .skill-display-mobile > .balance-container {
    font-size: 0.8em;
  }
  .options-display-mobile {
    flex: 1;
    align-items: flex-end;
  }
}
</style>

<style scoped>
.notice-headline {
  text-align: center;
  padding: 10px 0;
  background-color: #000;
}
.notice-headline p {
  margin: 0;
}
.notice-headline span {
  font-weight: 700;
}
.logo {
  max-width: 86px;
}
.main-nav > .view-links {
  flex: 2.3;
}
.nav-logo {
  flex: 0.3;
}

.expand-collapse-icon {
  position: relative;
  color: #9e8a57;
}

.expander-button {
  position: absolute;
  height: 27px;
  width: 27px;
  background: #200334;
  border: 1px solid #312e21 !important;
  border-radius: 0.1em;
  padding: 0;
  margin-top: -5px;
  margin-right: 0;
}

.expander-button.focus,
.expander-button:focus,
.expander-button:active {
  box-shadow: none;
}

.container_row {
  display: grid;
  justify-items: center;
  position: relative;
}

.expander-divider {
  width: 100%;
  position: relative;
}

.expander-divider,
.expander-button {
  grid-column: 1;
  grid-row: 1;
}

.nav-bottom-line {
  border-top: 3px solid;
  border-image-slice: 1;
  border-top-width: 3px;
  border-image-source: linear-gradient(to left, #3add9a, #121154, #a54476);
  background-image: radial-gradient(
      ellipse at top,
      #cba938 -10%,
      transparent 35%
    ),
    radial-gradient(ellipse at bottom, transparent, transparent);
}

.option-container-mobile input,
.option-container-mobile label i,
.nav-logo-mobile,
.options-display-mobile {
  display: none;
}

@media (max-width: 1400px) {
  .main-nav {
    display: flex;
    padding: 20px 10px;
    justify-content: space-between;
  }

  .nav-logo-mobile,
  .options-display-mobile {
    display: block;
  }

  .nav-logo,
  .view-links.desktop,
  .claim-rewards,
  .option-container-mobile input {
    display: none;
  }

  .skill-balance-display,
  .option-desktop {
    display: none !important;
  }

  .option-container-mobile {
    width: 30px;
  }

  .option-container-mobile label i {
    font-size: 2em;
    color: #cd894c;
    display: block;
  }

  .modal {
    /* position: fixed; */
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    display: none;
    animation: fadein linear 0.3s;
    z-index: 100;
  }
  .modal__overlay {
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.4);
  }
  @keyframes fadein {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .input__modal:checked ~ .modal {
    display: flex;
  }
  .input__modal:checked ~ .modal__body {
    transform: translateX(0);
    opacity: 1;
  }
  .modal__body {
    position: fixed;
    top: 0;
    right: 0;
    width: 300px;
    height: 100%;
    background-color: #000;
    transform: translateX(100%);
    transition: all linear 0.4s;
    opacity: 0;
    z-index: 1000;
    overflow: scroll;
  }
}
</style>
