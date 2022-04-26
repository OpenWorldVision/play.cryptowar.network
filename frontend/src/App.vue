<template>
  <div class="app app-v2">
    <router-view v-if="isMaintenance" />
    <div v-if="!isMaintenance" class="container-box">
      <nav-bar />
      <div class="content dark-bg-text">
        <router-view v-if="canShowApp" />
      </div>
      <div
        class="fullscreen-warning"
        v-if="showMetamaskWarning && isMetamask"
        sytle="z-index: 100"
      >
        <div class="starter-panel not-connect">
          <span class="starter-panel-heading"
            >Metamask Not Detected Or Incorrect Network</span
          >
          <div class="center row button-div">
            <big-button
              class="btn btn-pink-bg modal-btn"
              v-html="`Add MetaMask`"
              @click="startOnboarding"
              v-if="showMetamaskWarning"
            />
            <big-button
              class="btn btn-pink-bg modal-btn"
              v-html="`Switch to BSC Network`"
              @click="configureMetaMask"
              v-if="showNetworkError"
            />
            <small-button
              class="btn btn-blue-bg modal-btn"
              @click="toggleHideWalletWarning"
              v-html="'Hide Warning'"
            />
          </div>
          <div
            class="back-btn"
            @click="
              isMetamask = false
              hideWalletWarning = false
            "
          >
            <i class="fas fa-chevron-left"></i>
          </div>
        </div>
      </div>
      <div
        class="fullscreen-warning"
        v-if="
          !checkIncorectNetwork &&
          !isMaintenance &&
          !showMetamaskWarning &&
          hideWalletWarning &&
          !canShowApp
        "
        sytle="z-index: 100"
      >
        <div class="starter-panel not-connect switch-network">
          <span class="starter-panel-heading">Incorrect Network</span>
          <div class="center row button-div">
            <big-button
              class="btn btn-pink-bg modal-btn"
              v-html="`Switch to BSC Network`"
              @click="configureMetaMask"
            />
          </div>
        </div>
      </div>
      <b-modal id="warning" hide-footer centered>
        <div class="instructions-list">
          <p>
            To recruit your first character you need {{ recruitCost }} xBlade
            and .001 BNB for gas. You will also need .0015 BNB to do your first
            few battles, but don't worry, you earn the battle fees back in
            xBlade rewards immediately!
          </p>
        </div>
      </b-modal>
      <div
        class="fullscreen-warning"
        v-if="
          !hideWalletWarning &&
          (errorMessage || (ownCharacters.length === 0 && skillBalance === '0'))
        "
      >
        <div class="starter-panel connect-wallet">
          <span class="starter-panel-heading">{{
            errorMessage || 'Get Started With CryptoWars'
          }}</span>
          <div class="instructions-list">
            <!-- <p>
              To recruit your first character you need {{ recruitCost }} xBlade
              and .001 BNB for gas. You will also need .0015 BNB to do your
              first few battles, but don't worry, you earn the battle fees back
              in xBlade rewards immediately!
            </p> -->
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
                >Discord</a
              >
              /
              <a
                href="https://t.me/elasticbitcoinxbt"
                target="_blank"
                rel="noopener noreferrer"
                >Telegram</a
              >
              /
              <a
                href="https://twitter.com/xbladecryptowar"
                target="_blank"
                rel="noopener noreferrer"
                >Twitter</a
              >
            </p>
          </div>
          <button class="hide-modal" @click="toggleHideWalletWarning">
            <img src="./assets/images/btn-close.svg" />
          </button>
          <div class="button-div" v-if="!isMetamask">
            <big-button
              class="btn btn-pink-bg modal-btn"
              v-html="`WalletConnect`"
              @click="connectWalletConnect"
            />
            <big-button
              class="btn btn-pink-bg modal-btn"
              v-html="`MetaMask`"
              @click="checkMetamask"
            />
          </div>
          <div class="button-div" v-if="isMetamask">
            <big-button
              class="btn btn-pink-bg modal-btn"
              v-html="`Configure MetaMask`"
              @click="configureMetaMask"
            />
            <big-button
              v-bind:class="[isConnecting ? 'disabled' : '']"
              class="btn btn-pink-bg modal-btn"
              v-html="`Connect to metamask`"
              @click="connectMetamask"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import BN from 'bignumber.js'
import { mapState, mapActions, mapGetters } from 'vuex'
import _ from 'lodash'
import Vue from 'vue'
import Events from './events'
import MetaMaskOnboarding from '@metamask/onboarding'
import BigButton from './components/BigButton.vue'
import SmallButton from './components/SmallButton.vue'
import NavBar from './components/NavBar.vue'
import { getAddresses } from './addresses'
import WalletConnectProvider from '@walletconnect/web3-provider'


Vue.directive('visible', (el, bind) => {
  el.style.visibility = bind.value ? 'visible' : 'hidden'
})

const xBladeAsset = {
  type: 'ERC20',
  options: {
    address: '0xcaf53066e36eef55ed0663419adff6e503bd134f',
    symbol: 'xBlade',
    decimals: 18,
    image: 'https://cryptowar.network/android-chrome-512x512.png',
  },
}

export default {
  inject: ['web3'],
  components: {
    NavBar,
    BigButton,
    SmallButton,
  },

  data: () => ({
    errorMessage: '',
    hideWalletWarning: false,
    isConnecting: false,
    recruitCost: '',
    isMaintenance: false,
    isMetamask: false,
    expectedNetworkId: 0,
    expectedNetworkName: '',
    checkIncorectNetwork: true,
    walletConnectProvider: null,
    checkRefreshPage: false,
  }),

  computed: {
    ...mapState([
      'skillBalance',
      'defaultAccount',
      'currentNetworkId',
      'currentCharacterId',
      'staking',
    ]),
    ...mapGetters(['contracts', 'ownCharacters', 'getExchangeUrl']),

    canShowApp() {
      return (
        this.contracts !== null &&
        !_.isEmpty(this.contracts) &&
        !this.showNetworkError
      )
    },

    showMetamaskWarning() {
      return !this.web3.currentProvider
    },

    showNetworkError() {
      this.getExpectedNetwork()
      return (
        this.expectedNetworkId &&
        this.currentNetworkId !== null &&
        this.currentNetworkId !== this.expectedNetworkId
      )
    },
  },

  watch: {
    defaultAccount(account) {
      this.web3.eth.defaultAccount = account
    },

    async currentCharacterId() {
      await this.updateCharacterStamina(this.currentCharacterId)
    },
    $route(to) {
      document
        .querySelector('.app.app-v2')
        .classList.toggle(
          'bg2',
          this.$route.name === 'lobby' ||
            this.$route.name === 'arena' ||
            this.$route.name === 'luckywheel'
        )
      // react to route changes
      window?.gtag?.('event', 'page_view', {
        page_title: to.name,
        page_location: to.fullPath,
        page_path: to.path,
        // send_to: "G-C5RLX74PEW",
      })
    },
  },

  methods: {
    ...mapActions({ initializeStore: 'initialize' }),
    ...mapActions([
      'fetchCharacterStamina',
      'pollAccountsAndNetwork',
      'fetchCharacterTransferCooldownForOwnCharacters',
      'setupWeaponDurabilities',
      'fetchStakeDetails',
      'fetchWaxBridgeDetails',
      'fetchRewardsClaimTax',
    ]),

    getExpectedNetwork() {
      const expectedNetwork = getAddresses(this.currentNetworkId)
      this.expectedNetworkId = parseInt(
        expectedNetwork.VUE_APP_EXPECTED_NETWORK_ID,
        10
      )
      this.expectedNetworkName = expectedNetwork.VUE_APP_EXPECTED_NETWORK_NAME
    },

    async updateCharacterStamina(id) {
      if (id !== null) {
        await this.fetchCharacterStamina(id)
      }
    },

    checkStorage() {
      this.hideWalletWarning =
        localStorage.getItem('hideWalletWarning') === 'true'
    },

    checkMetamask() {
      this.isMetamask = true
      if (this.showMetamaskWarning) {
        this.hideWalletWarning = true
      }
    },

    async initializeRecruitCost() {
      const recruitCost = await this.contracts.CryptoWars.methods
        .mintCharacterFee()
        .call({ from: this.defaultAccount })
      const xBladeRecruitCost = await this.contracts.CryptoWars.methods
        .usdToxBlade(recruitCost)
        .call()
      this.recruitCost = BN(xBladeRecruitCost).div(BN(10).pow(18)).toFixed(4)
    },
    data() {
      return {
        recruitCost: this.recruitCost,
      }
    },

    async startOnboarding() {
      const onboarding = new MetaMaskOnboarding()
      onboarding.startOnboarding()
    },
    async configureMetaMask() {
      const web3 = this.web3.currentProvider
      if (this.currentNetworkId === 97) {
        try {
          await web3.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x61' }],
          })
        } catch (switchError) {
          try {
            await web3.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0x61',
                  chainName: 'Binance Smart Chain Testnet',
                  nativeCurrency: {
                    name: 'Binance Coin',
                    symbol: 'BNB',
                    decimals: 18,
                  },
                  // rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545/"],
                  rpcUrls: [
                    'https://speedy-nodes-nyc.moralis.io/eba7d2e0234f08d2741c13aa/bsc/testnet',
                  ],
                  blockExplorerUrls: ['https://testnet.bscscan.com'],
                },
              ],
            })
          } catch (addError) {
            console.error(addError)
          }
        }

        try {
          await web3.request({
            method: 'wallet_watchAsset',
            params: xBladeAsset,
          })
        } catch (error) {
          console.error(`Watch asset error: ${error}`)
        }
      } else {
        {
          try {
            await web3.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x38' }],
            })
          } catch (switchError) {
            try {
              await web3.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    chainId: '0x38',
                    chainName: 'Binance Smart Chain Mainnet',
                    nativeCurrency: {
                      name: 'Binance Coin',
                      symbol: 'BNB',
                      decimals: 18,
                    },
                    rpcUrls: ['https://bsc-dataseed.binance.org/'],
                    blockExplorerUrls: ['https://bscscan.com/'],
                  },
                ],
              })
            } catch (addError) {
              console.error(addError)
            }
          }

          try {
            await web3.request({
              method: 'wallet_watchAsset',
              params: xBladeAsset,
            })
          } catch (error) {
            console.error(error)
          }
        }
      }
    },

    async connectMetamask() {
      this.isConnecting = true
      this.errorMessage = 'Connecting to MetaMask...'

      const web3 = this.web3.givenProvider
      web3
        .request({ method: 'eth_requestAccounts' })
        .then(() => {
          this.errorMessage = 'Success: MetaMask connected.'
          this.isConnecting = false
          localStorage.setItem('checkRefreshPage', 'true')
          this.initializeStore()
          this.toggleHideWalletWarning()
        })
        .catch(() => {
          this.errorMessage = 'Error: MetaMask could not get permissions.'
          this.isConnecting = false
        })

      this.isConnecting = true
      this.errorMessage = 'Connecting to MetaMask...'
    },

    async connectWalletConnect() {
      this.isConnecting = true
      this.errorMessage = 'Connecting to WalletConnect...'

      try {
        this.walletConnectProvider = new WalletConnectProvider({
          rpc: {
            97: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
            56: 'https://bsc-dataseed.binance.org/',
          },
        })

        this.walletConnectProvider.on('connect', () => {
          this.toggleHideWalletWarning()
        })

        await this.walletConnectProvider.enable()
        this.web3.setProvider(this.walletConnectProvider)

        this.errorMessage = "Success: Walletconnect connected."
        this.isConnecting = false

        this.initializeStore()
      }
      catch(errorMessage) {
        this.web3.setProvider(this.walletConnectProvider)
        this.errorMessage = "Get Started With CryptoWars"
        console.error(errorMessage)
      }
    },

    toggleHideWalletWarning() {
      this.hideWalletWarning = !this.hideWalletWarning
      if (this.hideWalletWarning)
        localStorage.setItem('hideWalletWarning', 'true')
      else localStorage.setItem('hideWalletWarning', 'false')

      Events.$emit('setting:hideWalletWarning', {
        value: this.hideWalletWarning,
      })
    },

    async showWarningDialog() {
      await new Promise((resolve) => setTimeout(resolve, 7500))

      if (
        this.hideWalletWarning &&
        !this.showMetamaskWarning &&
        (this.errorMessage ||
          this.showNetworkError ||
          (this.ownCharacters.length === 0 && this.skillBalance === '0'))
      ) {
        this.$dialog.notify.warning(
          `You have hidden the wallet warning and it would now be displayed. If you are trying to play,
        please disable the option and follow the instructions, otherwise close and ignore.`,
          {
            timeout: 0,
          }
        )
      }
    },
  },

  updated() {
    if (this.ownCharacters.length !== 0) {
      this.$bvModal.hide('warning')
    }
    if (localStorage.getItem('checkRefreshPage') === 'true') {
      localStorage.setItem('checkRefreshPage', 'false')
      location.reload()
    }
  },

  async mounted() {
    if (localStorage.getItem("walletconnect")) {
      this.connectWalletConnect()
    }

    setTimeout(() => {
      if (
        this.ownCharacters.length === 0 &&
        this.skillBalance === '0' &&
        this.hideWalletWarning
      ) {
        this.$bvModal.show('warning')
      }
    }, 2000)

    document
      .querySelector('.app.app-v2')
      .classList.toggle(
        'bg2',
        this.$route.name === 'lobby' ||
          this.$route.name === 'arena' ||
          this.$route.name === 'luckywheel'
      )
    this.checkStorage()

    Events.$on('setting:hideRewards', () => this.checkStorage())
    Events.$on('setting:useGraphics', () => this.checkStorage())
    Events.$on('setting:hideWalletWarning', () => this.checkStorage())

    document.body.addEventListener('click', (e) => {
      const tagname = e.target.getAttribute('tagname')
      if (!tagname) return

      if (e.target.nodeName === 'BUTTON') {
        window?.gtag?.('event', 'button_clicked', {
          value: tagname,
        })
      }

      if (e.target.className.includes('gtag-link-others')) {
        window?.gtag?.('event', 'nav', {
          event_category: 'navigation',
          event_label: 'navbar',
          value: tagname,
        })
      }
    })

    this.showWarningDialog()
  },

  async created() {
    // this.isMaintenance = process.env.VITE_MAINTAINANCE;
    // if(window.location.pathname !== '/maintenance'){
    //   window.location.href = 'maintenance';
    // }
    let expectedNetworkID = 0

    if (this.walletConnectProvider?.connected) {
      expectedNetworkID = this.walletConnectProvider.chainId
    }
    else {
      expectedNetworkID = await this.web3.eth.net.getId()
    }

    if (
      getAddresses(expectedNetworkID).VUE_APP_EXPECTED_NETWORK_ID !==
      expectedNetworkID.toString()
    ) {
      this.checkIncorectNetwork = false
    }
    try {
      await this.initializeStore()
    } catch (e) {
      this.errorMessage =
        'Welcome to CryptoWars. Here is how you can get started.'
      if (e.code === 4001) {
        this.errorMessage = 'Error: MetaMask could not get permissions.'
      }

      console.error(e)
      throw e
    }

    this.pollCharactersStaminaIntervalId = setInterval(async () => {
      this.ownCharacters.forEach(async (c) => {
        await this.updateCharacterStamina(c.id)
      })
    }, 5000)

    // TODO: Debug 3 function to get error reason
    this.slowPollIntervalId = setInterval(async () => {
      await Promise.all([
        this.fetchCharacterTransferCooldownForOwnCharacters(),
        this.setupWeaponDurabilities(),
        this.fetchRewardsClaimTax(),
      ])
    }, 10 * 1000)

    this.doPollAccounts = true
    const pollAccounts = async () => {
      if (!this.doPollAccounts) return

      try {
        await this.pollAccountsAndNetwork()
      } catch (e) {
        console.error(e)
      }

      setTimeout(pollAccounts, 200)
    }

    pollAccounts()

    if (!localStorage.getItem('useGraphics'))
      localStorage.setItem('useGraphics', 'false')
    if (!localStorage.getItem('hideRewards'))
      localStorage.setItem('hideRewards', 'false')
    if (!localStorage.getItem('hideWalletWarning'))
      localStorage.setItem('hideWalletWarning', 'false')
    if (!localStorage.getItem('fightMultiplier'))
      localStorage.setItem('fightMultiplier', '1')

    this.initializeRecruitCost()
  },

  beforeDestroy() {
    this.doPollAccounts = false
    clearInterval(this.pollCharacterStaminaIntervalId)
    clearInterval(this.slowPollIntervalId)
  },
}
</script>

<style lang="scss">
#fightResultsModal .modal-header .close,
#selectHeroOrWeaponModal .modal-header .close,
#requestSelect .modal-header .close,
#fightModal .modal-header .close,
#listHeroToCareerModal .modal-header .close,
#listHeroToChallengeModal .modal-header .close,
#cancelRequestModal .modal-header .close {
  font-size: 0;
}
html {
  overscroll-behavior: auto;
  overflow: hidden;
  height: 100%;
}

body {
  overscroll-behavior: auto;
  overflow: auto;
  height: 100%;
}
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

  // font-size: 2rem;
  text-align: center;
  margin: auto;
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
  color: white;
}

.water,
.int {
  color: cyan;
}

.lightning,
.cha {
  color: yellow;
}

// .tooltil-icon-element{
//   width: 1.5rem;
//   height: 1.5rem;
//   margin-left: 5px;
// }

.fire-icon.tooltil-icon-element,
.earth-icon.tooltil-icon-element,
.water-icon.tooltil-icon-element,
.lightning-icon.tooltil-icon-element,
.dex-icon.tooltil-icon-element,
.int-icon.tooltil-icon-element,
.cha-icon.tooltil-icon-element,
.str-icon.tooltil-icon-element {
  width: 1.5rem;
  height: 1.5rem;
  margin-left: 5px;
}

.fire-icon,
.str-icon {
  color: red;
  content: url('assets/elements/fire.png');
  width: 2rem;
  height: 2rem;
}

.earth-icon,
.dex-icon {
  color: green;
  content: url('assets/elements/earth.png');
  width: 2rem;
  height: 2rem;
}

.water-icon,
.int-icon {
  color: cyan;
  content: url('assets/elements/water.png');
  width: 2rem;
  height: 2rem;
}

.lightning-icon,
.cha-icon {
  color: yellow;
  content: url('assets/elements/lightning.png');
  width: 2rem;
  height: 2rem;
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

.btn-primary,
.btn-primary.focus,
.btn-primary:focus,
.btn-primary.disabled:not(:hover) .btn-primary:disabled:hover {
  background-color: transparent;
  background-image: url('assets/images/bt-bg-center.png');
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
  content: ' ';
  width: 44px;
  height: 100%;
  background: url('assets/images/bt-bg-right.png') 100% 0 no-repeat;
  position: absolute;
  top: 0;
  right: -22px;
  z-index: -1;
  box-shadow: 6px 0 8px 0px #ffc1074d;
  background-color: #ffc10729;
  transition: all 0.3s ease-in;
}
.btn-primary::before {
  background: url('assets/images/bt-bg-left.png') 0 0 no-repeat;
  left: -22px;
  right: inherit;
  width: 70px;
  box-shadow: -6px 0 8px 0px #ffc1074d;
  background-color: #ffc10729;
}

.btn-primary:not(:disabled):hover,
.btn-primary:not(:disabled):not(.disabled):active {
  background-image: url('assets/images/bt-bg-center-hover.png');
  color: #000;
}

.btn-primary:not(:disabled):hover::before {
  background-image: url('assets/images/bt-bg-left-hover.png');
}
.btn-primary:not(:disabled):hover::after {
  background-image: url('assets/images/bt-bg-right-hover.png');
}

.btn-primary:active {
}

.btn-outline-primary {
  color: #a50eb3 !important;
}

#fightResultsModal .modal-content,
#listHeroToChallengeModal .modal-content {
  min-width: 36rem;
  height: 100%;
  display: flex;
  align-items: center;
}

#listHeroToCareerModal .modal-content,
#loadingModal .modal-content,
#claimRewardsSucessModal .modal-content {
  min-width: 36rem;
  height: 360px;
  display: flex;
  align-items: center;
}

#listHeroToCareerModal .modal-content {
  height: 475px;
}

#fightResultsModal .close,
#claimRewardsSucessModal .close {
  margin-right: 12px;
  z-index: 2;
}

#error-request-fight .modal-content {
  height: 190px;
}

// #showWeaponModal .modal-dialog{
//   width:870px;
// }

#showWeaponModal .modal-content {
  height: 580px;
  width: 870px;
  max-width: 870px;
}

#cancelRequestModal .close,
#requestSelect .close,
#selectHeroOrWeaponModal .close,
#selectHeroModal .close {
  margin-right: 55px;
}

#selectHeroOrWeaponModal .close,
#listHeroToChallengeModal .close,
#listHeroToCareerModal .close,
#selectHeroModal .close {
  margin-right: 30px;
}

#requestSelect .modal-content,
#fightModal .modal-content,
#cancelRequestModal .modal-content {
  min-width: 700px;
  height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
}

#selectHeroOrWeaponModal .modal-content,
#selectHeroModal .modal-content {
  height: 100%;
}

#selectHeroOrWeaponModal .modal-dialog,
#selectHeroModal .modal-dialog {
  display: flex;
  justify-content: center;
  align-items: center;
}

#selectHeroOrWeaponModal .modal-body,
#selectHeroModal .modal-body {
  overflow: scroll;
}

#requestSelect .modal-content,
#fightModal .modal-content {
  padding: 20px 0;
}

#fightResultsModal .modal-body {
  color: #fff;
  margin-top: 25px;
}

#selectHeroOrWeaponModal .modal-content,
#selectHeroModal .modal-content,
#setStaminalModal .modal-content {
  background-image: url(./assets/v2/bg-modal.png);
}

.modal-header {
}

.modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
}

// .modal-footer {
//   background: rgb(31, 31, 34);
//   border-color: rgba(24, 27, 30, 0.5) !important;
// }

#selectHeroOrWeaponModal .list,
#selectHeroModal .list {
  color: #fff;
  overflow-y: scroll;
  padding: 0;
  margin-top: 20px;
  margin-bottom: 40px;
  scroll-margin-left: 50px;
}

.modal-body {
  // display: flex;
  // flex-direction: column;
  // align-items: center;
}

// .modal-footer {
//   background: rgb(31, 31, 34);
//   border-color: rgba(24, 27, 30, 0.5) !important;
// }

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

.tabs > div:first-child {
  display: flex;
  justify-content: center;
}

.nav.nav-tabs.nav-justified {
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  padding: 0 2%;
}

.nav-tabs {
  border-bottom: none !important;
}

.tab-categories.nav-tabs {
  // border-bottom: 1px solid #f76d00 !important;
}

.nav-justified > .nav-link,
.nav-justified .nav-item {
  flex-basis: initial;
  flex-grow: initial;
}

.main-font .nav-tabs a.nav-link {
  font-size: 20px;
  color: #fff;
}

#warning .modal-content {
  display: flex;
  justify-content: center;
  width: 750px;
}

@media (max-width: 577px) {
  #listHeroToCareerModal .modal-body {
    width: 300px;
  }

  #listHeroToCareerModal .modal-content,
  #claimRewardsSucessModal .modal-content {
    min-width: 20rem;
    height: 240px;
    background-size: contain !important;
  }

  .main-font .nav-tabs a.nav-link {
    font-size: 15px;
  }
  #loadingModal .modal-content,
  #fightResultsModal .modal-content,
  #listHeroToChallengeModal .modal-content,
  #requestFightModal .modal-content {
    min-width: 20rem;
    height: 250px;
    display: flex;
    align-items: center;
    background-size: contain !important;
  }

  #fightResultsModal .modal-content {
    padding: 0;
    min-width: 22rem;
    height: 230px;
  }

  #showWeaponModal .modal-content,
  #claimModal .modal-content,
  #selectHeroOrWeaponModal .modal-content,
  #selectHeroModal .modal-content {
    width: 350px;
    background-image: none;
    background-color: #0c012c;
    border: 1px solid #f48757;
    border-radius: 20px 30px 20px 20px;
    position: relative;
  }

  #selectHeroOrWeaponModal .modal-content,
  #selectHeroModal .modal-content {
    padding: 0;
    height: 646px;
  }

  #showWeaponModal .modal-content::after,
  #claimModal .modal-content::after,
  #selectHeroOrWeaponModal .modal-content::after,
  #selectHeroModal .modal-content::after {
    content: '';
    background-image: url(./assets/v2/corner_yellow.svg);
    background-repeat: no-repeat;
    background-size: contain;
    width: 80px;
    height: 90px;
    position: absolute;
    top: -9px;
    right: -8px;
  }

  #claimModal .close,
  #selectHeroOrWeaponModal .close,
  #selectHeroModal .close {
    z-index: 1;
  }
}

@media (max-width: 767.98px) {
  #warning .modal-header {
    position: relative;
  }

  #warning .modal-header .close {
    position: absolute;
    top: -30px;
    right: -5px;
  }

  #warning .modal-content {
    // padding: 0;
    width: 360px;
    height: 240px;
  }
}

.nav-tabs .nav-link.active {
  color: #f58b5b !important;
  border-bottom: 5px solid #f58b5b !important;
  border-top-color: transparent !important;
  border-left-color: transparent !important;
  border-right-color: transparent !important;
  background-color: transparent !important;
  font-family: 'Rubik';
}

.nav-tabs .nav-link:hover {
  // border-bottom: 5px solid #F58B5B !important;
  border-color: transparent transparent #f58b5b transparent !important ;
}

.containerRight .nav-tabs .nav-link:hover,
.nav-justified.nav-tabs .nav-link:hover {
  border-bottom: 5px solid #f58b5b !important;
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
  margin-top: 137px;
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
  max-width: 100%;
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
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.starter-panel.not-connect {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.starter-panel-heading {
  margin-top: 1.2rem;
  font-size: 2.8rem;
  font-weight: bold;
  color: #f58b5b;
  display: block;
}

.starter-panel .button-div h1 {
  font-size: 1.3rem;
}

.starter-panel .button-div {
  display: flex;
  justify-content: center;
  align-items: center;
}

.starter-panel p {
  margin-bottom: 2rem;
}

.hide-modal {
  position: absolute;
  right: 1.5rem;
  top: 1rem;
  background: none;
  border: none;
}

.starter-msg {
  font-size: 0.85em;
}
.instructions-list {
  text-align: center;
  padding: 30px 20px 15px 0;
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

.starter-panel a {
  color: #f58b5b;
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

.modal-btn {
  background-size: 210px 50px !important;
  min-width: 210px;
  font-size: 14px;
  min-height: 50px;
  background-size: 230px 50px;
}

.modal-btn.btn-blue-bg {
  background-size: 210px 54px !important;
  min-height: 54px;
}

.back-btn {
  position: absolute;
  font-size: 30px;
  top: 30px;
  left: 50px;
  cursor: pointer;
}

@media (max-width: 767.98px) {
  .hide-modal {
    right: 4px;
    top: 0;
  }

  .starter-panel {
    /* padding-top: 0; */
    width: 400px;
    height: 260px;
    /* padding-top: 1.4em;
    background-size: cover; */
  }

  .starter-panel.not-connect {
    padding: 20px;
    justify-content: space-around;
  }

  .starter-panel-heading {
    font-size: 21px;
    margin-top: 0;
    padding: 0px 10px;
  }

  .starter-panel p {
    margin-bottom: 0;
  }

  .instructions-list {
    font-size: 16px;
    padding-bottom: 5px;
    padding: 10px;
  }

  .button-div {
    margin-top: 0;
  }

  .modal-btn {
    background-size: 210px 50px !important;
    padding-top: 0;
    padding-bottom: 0;
    font-size: 12px;
  }

  .starter-panel.connect-wallet .modal-btn {
    background-size: 160px 50px !important;
    min-width: 160px;
  }

  .starter-panel.connect-wallet .modal-btn::before {
    top: -4px;
    left: 0;
  }

  .starter-panel.connect-wallet .modal-btn::after {
    bottom: -4px;
    right: 0;
  }

  .back-btn {
    top: 20px;
    left: 25px;
  }
}

@media all and (max-width: 767.98px) {
  .content {
    padding: 0px;
  }

  .fullscreen-warning .button {
    margin-bottom: 1rem;
    justify-content: center;
  }
  .blank-slate .button h1 {
    font-size: 1.5rem;
  }
}
@media (max-width: 1400px) {
  .content {
    margin-top: 177px;
  }
}
.not-connect.switch-network {
  width: 450px;
  height: 320px;
  justify-content: space-around;
}
@media (max-width: 767.98px) {
  .not-connect.switch-network {
    width: 400px;
    height: 290px;
  }
  .content {
    margin-top: 200px;
  }
}
@media (max-width: 375.98px) {
  .not-connect.switch-network {
    width: 300px;
    height: 210px;
  }
}
</style>