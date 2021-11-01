<template>
  <div>
    <div
      class="character-earning-potential dark-bg-text"
      v-if="!isLoadingCharacter"
    >
      <div class="milestone-header-box">
        <div class="milestone-header">
          <div class="milestone-item">
            <span class="milestone-text">Next Milestone</span>
          </div>
          <div class="milestone-item">
            Earn
            <span class="bonus-text">
              {{ getNextMilestoneBonus(currentCharacter.level) }}%
            </span>
            more per battle at
            <span class="milestone-lvl-text"
              >LVL {{ getNextMilestoneLevel(currentCharacter.level) }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { CharacterPower } from "@/interfaces";
import Vue from "vue";
import { mapGetters } from "vuex";
import { toBN, fromWeiEther } from "../../utils/common";

export default Vue.extend({
  computed: {
    ...mapGetters([
      "currentCharacter",
      "currentWeapon",
      "fightGasOffset",
      "fightBaseline",
    ]),

    isLoadingCharacter(): boolean {
      return !this.currentCharacter;
    },
  },

  data() {
    return {
      characterElementValue: "",
      levelSliderValue: 1,
      staminaSelectValue: 40,
      starsValue: 1,
      wepElementValue: "",
      wepFirstStatElementValue: "",
      wepSecondStatElementValue: "",
      wepThirdStatElementValue: "",
      wepFirstStatSliderValue: 4,
      wepSecondStatSliderValue: 4,
      wepThirdStatSliderValue: 4,
      wepBonusPowerSliderValue: 0,
      bnbPrice: 0,
      skillPrice: 0,
      calculationResults: [] as number[][],
    };
  },

  methods: {
    getNextMilestoneBonus(level: number): string {
      const nextMilestoneLevel = this.getNextMilestoneLevel(level);
      return this.getRewardDiffBonus(level, nextMilestoneLevel);
    },

    getNextMilestoneLevel(level: number): number {
      return (Math.floor(level / 10) + 1) * 10 + 1;
    },

    getAverageRewardAtLevel(level: number): number {
      return (
        this.formattedSkill(this.fightGasOffset) +
        this.formattedSkill(this.fightBaseline) *
          Math.sqrt(CharacterPower(level - 1) / 1000)
      );
    },

    getRewardDiffBonus(level: number, targetLevel: number): string {
      return (
        ((this.getAverageRewardAtLevel(targetLevel) /
          this.getAverageRewardAtLevel(level + 1)) *
          100 -
          100) /
        10
      ).toFixed(2);
    },

    formattedSkill(skill: number): number {
      const skillBalance = fromWeiEther(skill.toString());
      return toBN(skillBalance).toNumber();
    },
  },
});
</script>
<style scoped>
.milestone-text {
  color: #f9974e;
}

.milestone-details {
  line-height: 1;
}

.bonus-text {
  color: rgb(5, 202, 94);
  margin: 0 8px;
  font-weight: 600;
}

.milestone-lvl-text {
  color: rgb(250, 149, 33);
  margin: 0 8px;
  font-weight: 600;
}

.calculator-icon-div {
  margin-top: 6px;
}
.char-placeholder {
  align-self: center;
  height: 15rem;
  width: initial;
}

.wep-placeholder {
  align-self: center;
  height: 9rem;
  width: initial;
}

.calculator {
  display: flex;
  flex-direction: row;
  align-content: center;
  justify-content: space-between;
}

.calculator-weapon,
.calculator-earnings,
.calculator-character {
  display: flex;
  flex-direction: column;
}

.calculator-character {
  justify-self: flex-start;
  width: 20%;
  padding-right: 5px;
}

.milestone-header .milestone-item {
  display: flex;
  text-align: center;
  justify-content: flex-start;
}

.milestone-header-box {
  display: flex;
  padding: 5px;
}

.calculator-weapon {
  justify-self: flex-end;
  width: 20%;
  padding-left: 5px;
}

.stat-slider {
  width: 100%;
}

.form-control.stat-input {
  width: 45px;
  height: 20px;
  padding: 0;
}

.form-control.power-input {
  width: 55px;
  height: 20px;
  padding: 0;
}

.slider-input-div {
  display: flex;
  flex-direction: row;
  margin-top: 5px;
}

.calculator-subheader {
  text-align: center;
  font-weight: 700;
}

.b-rating.stars-picker {
  background-color: #5b553d;
}

.form-control.wep-trait-form {
  padding: 0;
  height: 1.5em;
  font-size: small;
  margin-top: 5px;
}

.milestone-hint {
  margin-left: 5px;
}

.prices-div {
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.coin-price-inputs {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.calculator-earnings {
  width: 100%;
}

.token-price-div {
  display: flex;
  flex-direction: row;
  margin: 0 10px 0 10px;
}

.form-control.price-input {
  width: 70px;
  height: 20px;
  padding: 0;
}

.earnings-grid {
  width: 100%;
  height: max-content;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.results {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 20px;
}

.row {
  width: 100%;
}

.col {
  border: 1px solid #9e8a57;
  text-align: center;
}

.earnings-row .col {
  text-align: right;
}

.button-div {
  margin-top: 5px;
  display: flex;
  justify-content: center;
}

.button-div > * {
  margin: 5px;
}

.disabled-button {
  pointer-events: none;
}

.positive-value {
  color: green;
}

.negative-value {
  color: red;
}

.centered-icon {
  align-self: center;
  margin-left: 5px;
}

.btn-small {
  font-size: small;
  margin-top: 5px;
}

@media (max-width: 767.98px) {
  .calculator {
    flex-direction: column;
  }
  .calculator-character,
  .calculator-weapon {
    justify-self: center;
    width: 100%;
  }

  .calculator-weapon {
    margin-top: 2rem;
  }
}
</style>
