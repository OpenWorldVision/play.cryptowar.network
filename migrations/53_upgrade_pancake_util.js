const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

const CryptoWars = artifacts.require("CryptoWars");
let PancakeUtil = artifacts.require("PancakeUtil");

module.exports = async function (deployer, network, accounts) {
  if (network === "bscmainnet") {
    await CryptoWars.link(
      "PancakeUtil",
      "0x1647b6d73bAD8e9265ce2EFd4c589a195C1CA430"
    );

    const proxyAddress = "0x8BA9f0841cFA75d7e2c7a316b048b04c98C95cA4"; //mainnet
    await upgradeProxy(proxyAddress, CryptoWars, {
      deployer,
      unsafeAllow: ["external-library-linking"],
    });

    const game = await CryptoWars.at(
      "0x8BA9f0841cFA75d7e2c7a316b048b04c98C95cA4"
    );
    await game.setFightRewardBaselineValue(500); // $0.5
    await game.setBurnWeaponValue(800); // $8
    await game.setReforgeWeaponValue(1500); // $15
  }
};
