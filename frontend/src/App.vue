<template>
  <div class="app">
    <div class="container-box">
      <nav-bar />
      <character-bar
        v-if="!featureFlagStakeOnly && currentCharacterId !== null"
      />
      <div class="content dark-bg-text">
        <router-view v-if="canShowApp" />
      </div>
      <div
        class="fullscreen-warning"
        v-if="!hideWalletWarning && (showMetamaskWarning || showNetworkError)"
      >
        <div class="starter-panel">
          <span class="starter-panel-heading"
            >Metamask Not Detected Or Incorrect Network</span
          >
          <div class="center row">
            <big-button
              class="button"
              :mainText="`Add MetaMask`"
              @click="startOnboarding"
              v-if="showMetamaskWarning"
            />
            <big-button
              class="button"
              :mainText="`Switch to BSC Network`"
              @click="configureMetaMask"
              v-if="showNetworkError"
            />
            <small-button
              class="button btn-primary"
              @click="toggleHideWalletWarning"
              :text="'Hide Warning'"
            />
          </div>
        </div>
      </div>
      <div
        class="fullscreen-warning"
        v-if="
          !hideWalletWarning &&
          !showMetamaskWarning &&
          (errorMessage ||
            (ownCharacters.length === 0 &&
              skillBalance === '0' &&
              !hasStakedBalance))
        "
      >
        <div class="starter-panel">
          <span class="starter-panel-heading">{{
            errorMessage || "Get Started With CryptoWars"
          }}</span>
          <div class="instructions-list">
            <p>
              To recruit your first character you need {{ recruitCost }} xBlade
              and .001 BNB for gas. You will also need .0015 BNB to do your
              first few battles, but don't worry, you earn the battle fees back
              in xBlade rewards immediately!
            </p>
            <!-- <ul class="unstyled-list">
            <li>1. Buying BNB with fiat: <a href="https://youtu.be/6-sUDUE2RPA" target="_blank" rel="noopener noreferrer">Watch Video</a></li>
            <li>
              2. Once you have BNB, go to ApeSwap to obtain xBlade tokens:<br />
              <a v-bind:href="`${getExchangeUrl}`" target="_blank">Trade xBlade/BNB</a>
            </li>
            <li>
              3. Follow this tutorial to swap BNB for xBlade: <a href="https://youtu.be/_zitrvJ7Hl4" target="_blank" rel="noopener noreferrer">Watch Video</a>
            </li>
            <li>
              4. That's it! Now you can create your first character: (<a href="https://youtu.be/ZcNq0jCa28c" target="_blank" rel="noopener noreferrer"
                >Watch 'Getting Started' Video</a
              >)
            </li>
          </ul> -->
            <p>
              Join us on
              <a
                href="https://discord.gg/MQBWnE8t2G"
                target="_blank"
                rel="noopener noreferrer"
                >Discord</a> / <a
                href="https://t.me/elasticbitcoinxbt"
                target="_blank"
                rel="noopener noreferrer"
                >Telegram</a> / <a
                href="https://twitter.com/xbladecryptowar"
                target="_blank"
                rel="noopener noreferrer"
                >Twitter</a>
            </p>
          </div>
          <button
            class="hide-modal"
            @click="toggleHideWalletWarning"
          ><img src='./assets/images/btn-close.svg'/></button>
          <div class="button-div">
            <big-button
              class="button mm-button"
              :mainText="`Configure MetaMask`"
              @click="configureMetaMask"
            />
            <big-button
              v-bind:class="[isConnecting ? 'disabled' : '']"
              class="button mm-button"
              :mainText="`Connect to MetaMask`"
              @click="connectMetamask"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BN from "bignumber.js";

import { mapState, mapActions, mapGetters } from "vuex";
import _ from "lodash";
import Vue from "vue";
import Events from "./events";
import MetaMaskOnboarding from "@metamask/onboarding";
import BigButton from "./components/BigButton.vue";
import SmallButton from "./components/SmallButton.vue";
import NavBar from "./components/NavBar.vue";
import CharacterBar from "./components/CharacterBar.vue";
import { apiUrl, defaultOptions } from "./utils/common";

Vue.directive("visible", (el, bind) => {
  el.style.visibility = bind.value ? "visible" : "hidden";
});

export default {
  inject: [
    "web3",
    "featureFlagStakeOnly",
    "expectedNetworkId",
    "expectedNetworkName",
  ],
  components: {
    NavBar,
    CharacterBar,
    BigButton,
    SmallButton,
  },

  data: () => ({
    errorMessage: "",
    hideWalletWarning: false,
    isConnecting: false,
    recruitCost: "",
  }),

  computed: {
    ...mapState([
      "skillBalance",
      "defaultAccount",
      "currentNetworkId",
      "currentCharacterId",
      "staking",
    ]),
    ...mapGetters([
      "contracts",
      "ownCharacters",
      "getExchangeUrl",
      "availableStakeTypes",
      "hasStakedBalance",
    ]),

    canShowApp() {
      return (
        this.contracts !== null &&
        !_.isEmpty(this.contracts) &&
        !this.showNetworkError
      );
    },

    showMetamaskWarning() {
      return !this.web3.currentProvider;
    },

    showNetworkError() {
      return (
        this.expectedNetworkId &&
        this.currentNetworkId !== null &&
        this.currentNetworkId !== this.expectedNetworkId
      );
    },
  },

  watch: {
    defaultAccount(account) {
      this.web3.eth.defaultAccount = account;
    },

    async currentCharacterId() {
      await this.updateCharacterStamina(this.currentCharacterId);
    },
    $route(to) {
      // react to route changes
      window.gtag("event", "page_view", {
        page_title: to.name,
        page_location: to.fullPath,
        page_path: to.path,
        send_to: "G-C5RLX74PEW",
      });
    },
  },

  methods: {
    ...mapActions({ initializeStore: "initialize" }),
    ...mapActions([
      "fetchCharacterStamina",
      "pollAccountsAndNetwork",
      "fetchCharacterTransferCooldownForOwnCharacters",
      "setupWeaponDurabilities",
      "fetchStakeDetails",
      "fetchWaxBridgeDetails",
      "fetchRewardsClaimTax",
    ]),

    async updateCharacterStamina(id) {
      if (this.featureFlagStakeOnly) return;

      if (id !== null) {
        await this.fetchCharacterStamina(id);
      }
    },

    checkStorage() {
      this.hideWalletWarning =
        localStorage.getItem("hideWalletWarning") === "true";
    },

    async initializeRecruitCost() {
      const recruitCost = await this.contracts.CryptoWars.methods
        .mintCharacterFee()
        .call({ from: this.defaultAccount });
      const xBladeRecruitCost = await this.contracts.CryptoWars.methods
        .usdToxBlade(recruitCost)
        .call();
      this.recruitCost = BN(xBladeRecruitCost).div(BN(10).pow(18)).toFixed(4);
    },
    data() {
      return {
        recruitCost: this.recruitCost,
      };
    },

    async startOnboarding() {
      const onboarding = new MetaMaskOnboarding();
      onboarding.startOnboarding();
    },
    async configureMetaMask() {
      const web3 = this.web3.currentProvider;
      if (this.currentNetworkId === 97) {
        try {
          await web3.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x61" }],
          });
        } catch (switchError) {
          try {
            await web3.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0x61",
                  chainName: "Binance Smart Chain Testnet",
                  nativeCurrency: {
                    name: "Binance Coin",
                    symbol: "BNB",
                    decimals: 18,
                  },
                  rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
                  blockExplorerUrls: ["https://testnet.bscscan.com"],
                },
              ],
            });
          } catch (addError) {
            console.error(addError);
          }
        }

        try {
          await web3.request({
            method: "wallet_watchAsset",
            params: {
              type: "ERC20",
              options: {
                address: "0xcaf53066e36eef55ed0663419adff6e503bd134f",
                symbol: "xBlade",
                decimals: 18,
                image: "https://cryptowar.network/android-chrome-512x512.png",
              },
            },
          });
        } catch (error) {
          console.error(error);
        }
      } else {
        {
          try {
            await web3.request({
              method: "wallet_switchEthereumChain",
              params: [{ chainId: "0x38" }],
            });
          } catch (switchError) {
            try {
              await web3.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x38",
                    chainName: "Binance Smart Chain Mainnet",
                    nativeCurrency: {
                      name: "Binance Coin",
                      symbol: "BNB",
                      decimals: 18,
                    },
                    rpcUrls: ["https://bsc-dataseed.binance.org/"],
                    blockExplorerUrls: ["https://bscscan.com/"],
                  },
                ],
              });
            } catch (addError) {
              console.error(addError);
            }
          }

          try {
            await web3.request({
              method: "wallet_watchAsset",
              params: {
                type: "ERC20",
                options: {
                  address: "0x27a339d9B59b21390d7209b78a839868E319301B",
                  symbol: "xBlade",
                  decimals: 18,
                  image: "https://cryptowar.network/android-chrome-512x512.png",
                },
              },
            });
          } catch (error) {
            console.error(error);
          }
        }
      }
    },

    async connectMetamask() {
      const web3 = this.web3.currentProvider;
      this.isConnecting = true;
      this.errorMessage = "Connecting to MetaMask...";
      web3
        .request({ method: "eth_requestAccounts" })
        .then(() => {
          this.errorMessage = "Success: MetaMask connected.";
          this.isConnecting = false;

          this.initializeStore();
          this.toggleHideWalletWarning();
        })
        .catch(() => {
          this.errorMessage = "Error: MetaMask could not get permissions.";
          this.isConnecting = false;
        });
    },

    toggleHideWalletWarning() {
      this.hideWalletWarning = !this.hideWalletWarning;
      if (this.hideWalletWarning)
        localStorage.setItem("hideWalletWarning", "true");
      else localStorage.setItem("hideWalletWarning", "false");

      Events.$emit("setting:hideWalletWarning", {
        value: this.hideWalletWarning,
      });
    },

    async showWarningDialog() {
      await new Promise((resolve) => setTimeout(resolve, 7500));

      if (
        this.hideWalletWarning &&
        !this.showMetamaskWarning &&
        (this.errorMessage ||
          this.showNetworkError ||
          (this.ownCharacters.length === 0 &&
            this.skillBalance === "0" &&
            !this.hasStakedBalance))
      ) {
        this.$dialog.notify.warning(
          `You have hidden the wallet warning and it would now be displayed. If you are trying to play,
        please disable the option and follow the instructions, otherwise close and ignore.`,
          {
            timeout: 0,
          }
        );
      }
    },

    async checkNotifications() {
      const response = await fetch(
        apiUrl("static/notifications"),
        defaultOptions
      );
      const notifications = await response.json();

      const lastHash = localStorage.getItem("lastnotification");
      let shouldContinue = true;

      notifications.forEach((notif) => {
        if (!shouldContinue) return;

        if (lastHash === notif.hash) {
          shouldContinue = false;
          return;
        }

        this.$dialog.notify.warning(
          `${notif.title}
          <br>
          <a href="${notif.link}" target="_blank">Check it out!</a>
          `,
          {
            timeout: 300000,
          }
        );
      });

      localStorage.setItem("lastnotification", notifications[0].hash);
    },
  },

  mounted() {
    this.checkStorage();

    Events.$on("setting:hideRewards", () => this.checkStorage());
    Events.$on("setting:useGraphics", () => this.checkStorage());
    Events.$on("setting:hideWalletWarning", () => this.checkStorage());

    document.body.addEventListener("click", (e) => {
      const tagname = e.target.getAttribute("tagname");
      if (!tagname) return;

      if (e.target.nodeName === "BUTTON") {
        window.gtag("event", "button_clicked", {
          value: tagname,
        });
      }

      if (e.target.className.includes("gtag-link-others")) {
        window.gtag("event", "nav", {
          event_category: "navigation",
          event_label: "navbar",
          value: tagname,
        });
      }
    });

    this.showWarningDialog();
  },

  async created() {
    try {
      await this.initializeStore();
    } catch (e) {
      this.errorMessage =
        "Welcome to CryptoWars. Here is how you can get started.";
      if (e.code === 4001) {
        this.errorMessage = "Error: MetaMask could not get permissions.";
      }

      console.error(e);
      throw e;
    }

    this.pollCharactersStaminaIntervalId = setInterval(async () => {
      this.ownCharacters.forEach(async (c) => {
        await this.updateCharacterStamina(c.id);
      });
    }, 3000);

    this.availableStakeTypes.forEach((item) => {
      this.fetchStakeDetails({ stakeType: item });
    });

    this.slowPollIntervalId = setInterval(async () => {
      await Promise.all([
        this.fetchCharacterTransferCooldownForOwnCharacters(),
        this.setupWeaponDurabilities(),
        // this.fetchWaxBridgeDetails(),
        this.fetchRewardsClaimTax(),
      ]);
    }, 10 * 1000);

    this.doPollAccounts = true;
    const pollAccounts = async () => {
      if (!this.doPollAccounts) return;

      try {
        await this.pollAccountsAndNetwork();
      } catch (e) {
        console.error(e);
      }

      setTimeout(pollAccounts, 200);
    };

    pollAccounts();

    if (!localStorage.getItem("useGraphics"))
      localStorage.setItem("useGraphics", "false");
    if (!localStorage.getItem("hideRewards"))
      localStorage.setItem("hideRewards", "false");
    if (!localStorage.getItem("hideWalletWarning"))
      localStorage.setItem("hideWalletWarning", "false");
    if (!localStorage.getItem("fightMultiplier"))
      localStorage.setItem("fightMultiplier", "1");

    this.checkNotifications();
    this.initializeRecruitCost();
  },

  beforeDestroy() {
    this.doPollAccounts = false;
    clearInterval(this.pollCharacterStaminaIntervalId);
    clearInterval(this.slowPollIntervalId);
  },
};
</script>

<style lang="scss">
button.btn.button.main-font.dark-bg-text.encounter-button.btn-styled.btn-primary
  > h1 {
  font-weight: 600;
  text-align: center;
  padding: 0;
}
hr.hr-divider {
  border-top: 1px solid #808080;
  margin-bottom: 0.5rem !important;
}
body {
  margin: 0;
  background: linear-gradient(
    45deg,
    rgba(20, 20, 20, 1) 100%,
    rgba(36, 39, 32, 1) 100%
  );
}

.no-margin {
  margin: 0;
}

.bold {
  font-weight: 1000;
}

.main-font {
}

.info-divider {
  width: 100%;
  position: relative;
  top: -10px;
}

.title-bg-text {
  color: #9e8a57;
}

.dark-bg-text {
  color: #fff;
}

button,
.pointer {
  cursor: pointer;
}

.blank-slate {
  width: calc(100vw - 36px);
  height: calc(100vh - 56px);

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  font-size: 2rem;
  text-align: center;
}

.error {
  color: red;
}

.fire,
.str {
  color: red;
}

.earth,
.dex {
  color: green;
}

.water,
.int {
  color: cyan;
}

.lightning,
.cha {
  color: yellow;
}

.fire-icon,
.str-icon {
  color: red;
  content: url("assets/elements/fire.png");
  width: 1em;
  height: 1em;
}

.earth-icon,
.dex-icon {
  color: green;
  content: url("assets/elements/earth.png");
  width: 1em;
  height: 1em;
}

.water-icon,
.int-icon {
  color: cyan;
  content: url("assets/elements/water.png");
  width: 1em;
  height: 1em;
}

.lightning-icon,
.cha-icon {
  color: yellow;
  content: url("assets/elements/lightning.png");
  width: 1em;
  height: 1em;
}

.loading-container {
  position: absolute;
  display: flex;
  justify-content: center;
  align-content: center;
  width: 100%;
  padding-top: 50%;
  font-size: 2rem;
  z-index: 541;
  color: #be9a2c;
}

button.close {
  color: #53034f !important;
}

.mm-button {
  margin: 5px;
  margin-left: 5px;
  margin-right: 5px;
}

.btn.disabled,
.btn:disabled {
  cursor: auto;
}

.btn-primary, .btn-primary.focus, .btn-primary:focus, .btn-primary.disabled:not(:hover) .btn-primary:disabled:hover{
  background-color: transparent;
  background-image: url("assets/images/bt-bg-center.png");
  background-repeat: repeat-x;
  background-position: 0 0;
  transition: all 0.3s ease-in;
  will-change: box-shadow, transform;
  font-size: 20px;
  height: 60px;
  border: 0px solid transparent !important;
  box-shadow: -6px 0 15px 0px #ffc1077d;
  margin-left: 37px;
  margin-right: 37px;
  color: #000;
  padding-right: 0;
  padding-left: 0;
  display: flex;
  align-items: center;
}

.btn-primary::after,
.btn-primary::before {
  content: " ";
  width: 44px;
  height: 100%;
  background: url("assets/images/bt-bg-right.png") 100% 0 no-repeat;
  position: absolute;
  top: 0;
  right: -22px;
  z-index: -1;
  box-shadow: 6px 0 8px 0px #ffc1074d;
  background-color: #ffc10729;
  transition: all 0.3s ease-in;
}
.btn-primary::before {
  background: url("assets/images/bt-bg-left.png") 0 0 no-repeat;
  left: -22px;
  right: inherit;
  width: 70px;
  box-shadow: -6px 0 8px 0px #ffc1074d;
  background-color: #ffc10729;
}


.btn-primary:not(:disabled):hover, .btn-primary:not(:disabled):not(.disabled):active {
  background-image: url("assets/images/bt-bg-center-hover.png");
  color: #000;
}

.btn-primary:not(:disabled):hover::before {
  background-image: url("assets/images/bt-bg-left-hover.png");
}
.btn-primary:not(:disabled):hover::after {
  background-image: url("assets/images/bt-bg-right-hover.png");
}

.btn-primary:active {
}

.btn-outline-primary {
  color: #a50eb3 !important;
}
.modal-content {
  border-radius: 20px;
}
.modal-header {
  color: #fff !important;
  background: rgb(31, 31, 34);
  border-color: rgba(24, 27, 30, 0.5) !important;
  font-weight: 600;
}

.modal-body {
  color: rgb(187, 187, 187) !important;
  background: rgb(31, 31, 34);
}

.modal-footer {
  background: rgb(31, 31, 34);
  border-color: rgba(24, 27, 30, 0.5) !important;
}

.b-pagination > li > .page-link {
  color: #a50eb3;
  background: linear-gradient(
    180deg,
    rgba(31, 31, 34, 1) 0%,
    rgba(24, 27, 30, 1) 5%,
    rgba(24, 38, 45, 1) 100%
  );
  border-color: #a50eb36e;
}

.b-pagination > .page-item.active > .page-link {
  color: #a50eb3;
  background: linear-gradient(
    180deg,
    rgba(31, 31, 34, 1) 0%,
    rgba(24, 27, 30, 1) 5%,
    rgba(24, 38, 45, 1) 100%
  );
  border-color: #a50eb3;
}

.b-pagination > .page-item.disabled > .page-link {
  color: #b3b0a72a;
  background: linear-gradient(
    180deg,
    rgba(31, 31, 34, 1) 0%,
    rgba(24, 27, 30, 1) 5%,
    rgba(24, 38, 45, 1) 100%
  );
  border-color: #a50eb36e;
}

.tabs > div:first-child{
  display: flex;
  justify-content: center;
}
.nav-tabs {
  border-bottom: none !important;
}

.nav-justified > .nav-link, .nav-justified .nav-item{
  flex-basis: initial;
  flex-grow: initial;
}

.main-font .nav-tabs a.nav-link{
  font-size: 1.1rem;
  color: #fff;
}

.nav-tabs .nav-link.active {
  color: #F58B5B !important;
  border-bottom: 5px solid #F58B5B !important;
  border-top-color: transparent !important;
  border-left-color: transparent !important;
  border-right-color: transparent !important;
  background-color: transparent !important;
}

.nav-tabs .nav-link:hover {
  border-bottom: 5px solid #F58B5B !important;
  border-color: transparent transparent #F58B5B transparent !important ;
}

.outline {
  color: #000;
  text-shadow: -1px 0 #fff, 0 1px #fff, 1px 0 #fff, 0 -1px #fff;
}

.black-outline {
  text-shadow: -1px 0 #000, 0 1px #000, 1px 0 #000, 0 -1px #000;
}

div.bg-success {
  background-color: #19682b !important;
}

.nav.nav-pills .nav-link {
  color: #a50eb3 !important;
  border: 2px solid #6c5f38;
  border-radius: 0.1em;
  background: rgb(31, 31, 34);
  background: linear-gradient(
    180deg,
    rgba(31, 31, 34, 1) 0%,
    rgba(24, 27, 30, 1) 5%,
    rgba(24, 38, 45, 1) 100%
  );
}

.nav.nav-pills .nav-link.active {
  border: 2px solid #a50eb3 !important;
  background: rgb(61, 61, 64);
  background: linear-gradient(
    180deg,
    rgba(51, 51, 54, 1) 0%,
    rgba(44, 47, 50, 1) 5%,
    rgba(44, 58, 65, 1) 100%
  );
}
</style>
<style scoped>
.content {
  padding: 0 1em;
  height: calc(100vh - 56px);
  margin: auto;
}

.fullscreen-warning {
  position: fixed;
  top: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.425);
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  font-size: 3rem;
  color: #fff;
}

.starter-panel {
  width: 50rem;
  height: calc(50rem * 0.69);
  max-width:  100%;
  background-image: url('assets/images/bg-modal.svg');
  background-position: 50% 0;
  background-size: contain;
  background-repeat: no-repeat;
  border-radius: 5px;
  padding: 0.5em;
  margin: auto;
  text-align: center;
  overflow: auto auto;
  position: relative;
}

.starter-panel-heading {
  margin-left: 15px;
  margin-top: 3rem;
  font-size: 2.8rem;
  font-weight: bold;
  color: #F58B5B;
  display: block;
}

.starter-panel .button-div h1{
  font-size: 1.3rem;
}

.starter-panel .button-div{
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
}

.starter-panel p{
  margin-bottom: 2rem;
}

.hide-modal{
  position: absolute;
  right: 1.5rem;
  top: 1rem;
  background: none;
  border: none
}

.starter-msg {
  font-size: 0.85em;
}
.instructions-list {
  text-align: center;
  padding: 30px 20px 15px 10px;
  font-size: 1.3rem;
}

.unstyled-list {
  list-style-type: none;
}
.seperator {
  border: 1px solid #9e5772;
  border-radius: 3px;
  width: 100%;
}

.starter-panel a{
  color: #F58B5B;
}

.mini-icon-starter {
  height: 1.2em;
  width: 1.2em;
  margin: 5px;
}

.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

.border-main {
  border: 1px solid #a50eb3;
}

@media all and (max-width: 767.98px) {
  .content {
    padding: 10px;
  }
  .dark-bg-text {
    width: 100%;
  }

  .fullscreen-warning .button{
    margin-bottom: 1rem;
    justify-content: center;
  }
  .starter-panel{
    background-size: auto 100%;
    background-position: -150px -36px;
  }
  .blank-slate .button h1{
    font-size: 1.5rem;
  }

}
</style>
