const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

const CryptoWars = artifacts.require("CryptoWars");
let PancakeUtil = artifacts.require("PancakeUtil");


module.exports = async function (deployer, network, accounts) {
  await deployer.deploy(PancakeUtil);
  await deployer.link(PancakeUtil, CryptoWars);

  // await CryptoWars.link('PancakeUtil','0xB68041fc1F00D8A59d76B243d86EE347c06F1a1B');
};
