const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

const CryptoWars = artifacts.require("CryptoWars");
let PancakeUtil = artifacts.require("PancakeUtil");


module.exports = async function (deployer, network, accounts) {

  // await deployer.deploy(PancakeUtil);
  // return
  // await deployer.link(PancakeUtil, CryptoWars);

  // await deployer.link(PancakeUtil, CryptoWars);

  // await CryptoWars.link('PancakeUtil','0xA51c29c2d39F8D0e5c689463dE6e03c9096B6cE2');

  // const proxyAddress = "0x8781413C768f207699D51f42b909c5d6A9D9aD36"; //testnet
  // const game = await CryptoWars.at('0x8BA9f0841cFA75d7e2c7a316b048b04c98C95cA4');
  const proxyAddress = "0x8BA9f0841cFA75d7e2c7a316b048b04c98C95cA4"; //mainnet
  await upgradeProxy(proxyAddress, CryptoWars, {
    deployer,
    unsafeAllow: ["external-library-linking"],
  });

  // const cwControllerAddress = "0xAadfa537ecA54d3d7655C4117bBFB83B9bF6035a"; // controller address
  // const game = await CryptoWars.at('0x8BA9f0841cFA75d7e2c7a316b048b04c98C95cA4');
  // await game.setFightRewardBaselineValue(200);


};
