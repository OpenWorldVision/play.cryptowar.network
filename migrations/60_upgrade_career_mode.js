const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

const CareerMode = artifacts.require("CareerMode");

module.exports = async function (deployer, network) {
  let careerModeProxy;
  if (network === "bsctestnet") {
    careerModeProxy = "0x4CC5739daEfA1ecfe0F827166C628196057377c6";
  }

  if (network === "bscmainnet") {
    careerModeProxy = "0x72E9A1be11609Ba5d03ae153f5e0d2F1064C169E";
  }
  await upgradeProxy(careerModeProxy, CareerMode, {
    deployer,
  });
};
