<template>
  <div class="character-art" v-tooltip="tooltipHtml(character)" ref="el">
    <div class="trait" v-if="!portrait">
      <span :class="characterTrait.toLowerCase() + '-icon circle-element'"></span>
    </div>

    <div class="placeholder d-flex align-items-start justify-content-center p-1"
      >
      <div class="w-100" :style="{
        'background-image': 'url(' + getCharacterArt(character) + ')',
      }"
      :class="{
        'h-100': !isMarket,
        'h-75': isMarket
      }">

      </div>
      <!--<small-button class="button" :text="`Purchase`" v-if="isMarket"/>-->
    </div>

    <div class="loading-container" v-if="!allLoaded">
      <i class="fas fa-spinner fa-spin"></i>
    </div>

    <div class="name-lvl-container">
      <div class="name black-outline" v-if="!portrait">{{ getCleanCharacterName(character.id) }} </div>
      <div v-if="!portrait">Lv.<span class="white">{{ character.level + 1 }}</span></div>
    </div>
    <div class="score-id-container">
    <div class="black-outline" v-if="!portrait">ID <span class="white">{{ character.id }}</span></div>
    <div class="black-outline" v-if="!portrait">
      Score <span class="white">{{ heroScore.toLocaleString() }}</span>
      <b-icon-question-circle class="centered-icon" scale="0.8" v-tooltip.bottom="`Hero score is a measure of your hero's combat prowess so far.
        It goes up when you win and down when you lose. It is also temporarily disabled!`"/>
    </div>
    </div>

    <div v-if="!portrait && isMarket" class="small-stamina-char"
      :style="`--staminaReady: ${(timestampToStamina(character.staminaTimestamp)/maxStamina)*100}%;`"
      v-tooltip.bottom="staminaToolTipHtml(timeUntilCharacterHasMaxStamina(character.id))">
      <div class="stamina-text black-outline">STA {{ timestampToStamina(character.staminaTimestamp) }} / 200</div>
    </div>

    <div class="xp" v-if="!portrait">
      <b-progress :max="RequiredXp(character.level)" variant="success"
      v-tooltip.bottom="`Claimable XP ${this.getCharacterUnclaimedXp(character.id)}`">
        <strong class="outline xp-text">{{ character.xp || 0 }} / {{ RequiredXp(character.level) }} XP</strong>
        <b-progress-bar :value="character.xp || 0"></b-progress-bar>
      </b-progress>
    </div>
  </div>
</template>

<script>
import { getCharacterArt } from '../character-arts-placeholder';
import { CharacterTrait, RequiredXp } from '../interfaces';
import { mapGetters, mapState } from 'vuex';
import { getCleanName } from '../rename-censor';

export default {
  props: ['character', 'portrait', 'isMarket'],
  components: {
    //SmallButton,
  },
  watch: {
    character() {
      this.clearScene();
    },
  },

  data() {
    return {
      allLoaded: false,
      allLoadStarted: false,
      camera: null,
      scene: null,
      renderer: null,
      baseMaterial: null,
      loadCount: 0,
      loadCountTotal: 0,
      modelLoader: null,
      textureLoader: null,
      body: null,
      trait: this.characterTrait,
      showPlaceholder: false,
      heroScore: 0
    };
  },

  computed: {
    ...mapState(['maxStamina']),
    ...mapGetters([
      'getCharacterName',
      'transferCooldownOfCharacterId',
      'getCharacterUnclaimedXp',
      'timeUntilCharacterHasMaxStamina',
      'charactersWithIds',
    ]),

    characterTrait() {
      const characterWithId = this.charactersWithIds && this.charactersWithIds([this.character.id]);
      return characterWithId && CharacterTrait[characterWithId[0].trait] || CharacterTrait[this.character.trait];
    }
  },

  methods: {
    RequiredXp,

    tooltipHtml(character) {
      if (!character) return '';

      const cooldown = this.transferCooldownOfCharacterId(this.character.id);
      if (cooldown) {
        if (cooldown === 86400)
          // edge case for when it's exactly 1 day and the iso string cant display
          return 'May not be traded for: 1 day';
        else return `May not be traded for: ${new Date(cooldown * 1000).toISOString().substr(11, 8)}`;
      }

      return '';
    },

    getCleanCharacterName(id) {
      return getCleanName(this.getCharacterName(id));
    },

    staminaToolTipHtml(time) {
      return 'Regenerates 1 point every 5 minutes, stamina bar will be full at: ' + time;
    },

    timestampToStamina(timestamp) {
      if(timestamp > Math.floor(Date.now()/1000)) return 0;
      return +Math.min((Math.floor(Date.now()/1000) - timestamp) / 300, 200).toFixed(0);
    },

    getCharacterArt,
    async fetchScore() {

    }
  },
  mounted() {
    this.fetchScore();
    this.allLoaded = true;
    this.showPlaceholder = true;
    return;
  },
};
</script>

<style scoped>
.character-art {
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  flex-direction: column;
}

.xp {
  position: absolute;
}

.trait {
  top: -30px;
  justify-self: center;
  margin: 0 auto;
  position: relative;
  display: flex;
}

.id {
  top: 5px;
  right: 5px;
  font-style: italic;
}

.hero-score {
  top: 25px;
  right: 5px;
  font-style: italic;
}

.name {
  font-weight: 900;
  overflow: hidden;
  max-height: 24px;
  max-width: 170px;
  white-space: nowrap;
}

.xp {
  bottom: -30px;
  left: 30px;
  width: 150px;
  right: 0;
}

.xp-text {
  padding-top: 7px;
  width: 100%;
  text-align: center;
  position: absolute;
}

.placeholder {
  max-width: 100%;
  top: 0;
  position: relative;
  height: 75%;
  padding-top: 0;
  -o-object-fit: contain;
  object-fit: contain;
}

.placeholder div{
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.circle-element {
  width: 1.7em;
  height: 1.7em;
  border-radius: 50%;
}

.name-lvl-container, .score-id-container {
  display :flex;
  justify-content: space-around;
  position: relative;
}

.white {
  color : rgb(204, 204, 204)
}

.small-stamina-char {
  position: relative;
  margin-top: -10px;
  top: 7px;
  align-self: center;
  height :14px;
  width: 180px;
  border-radius: 2px;
  border: 0.5px solid rgb(216, 215, 215);
  background : linear-gradient(to right, rgb(236, 75, 75) var(--staminaReady), rgba(255, 255, 255, 0.1) 0);
}

.stamina-text {
  position: relative;
  top: -3px;
  font-size: 75%;
  left: 0;
  right: 0;
  text-align: center;
  color: #fff;
}
</style>
