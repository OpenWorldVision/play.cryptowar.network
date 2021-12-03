const { upgradeProxy, deployProxy } = require("@openzeppelin/truffle-upgrades");

const CWController = artifacts.require("CWController");
const SecretBox = artifacts.require("SecretBox");
const CryptoWars = artifacts.require("CryptoWars");
const PancakeUtil = artifacts.require("PancakeUtil");

module.exports = async function (deployer, network, accounts) {
  if (network === "bsctestnet") {
    const controller = await deployProxy(CWController, [], { deployer });
    const router = "0x9ac64cc6e4415144c455bd8e4837fea55603e5c3";
    const busdAddress = "0x78867bbeef44f2326bf8ddd1941a4439382ef2a7";
    const xBladeAddress = "0x28ad774c41c229d48a441b280cbf7b5c5f1fed2b";
    await controller.migrate_v2(router, xBladeAddress, busdAddress);
    await controller.migrateTokenPrice();

    // Upgrade CryptoWars
    const cwAddress = "0x717829e31837963fb07dcfb0700423e5be71e5b4";

    await upgradeProxy(cwAddress, CryptoWars, {
      deployer,
      unsafeAllow: ["external-library-linking"],
    });
    const cryptoWar = await CryptoWars.at(cwAddress);
    // cryptoWar.setCWController(controller.address);
  }
  if (network === "bscmainnet") {
    const proxyAddress = "0xAadfa537ecA54d3d7655C4117bBFB83B9bF6035a";
    await upgradeProxy(proxyAddress, CWController, {
      deployer,
    });

    // const controller = await CWController.at(proxyAddress);
    // await controller.migrateTokenPrice();
    // await deployer.deploy(PancakeUtil);
    // await CryptoWars.link('PancakeUtil','0x4694737FD094f091C718698855A93DB235171315');

    // Upgrade CW
    const cwAddress = "0x8BA9f0841cFA75d7e2c7a316b048b04c98C95cA4";
    await upgradeProxy(cwAddress, CryptoWars, {
      deployer,
      unsafeAllow: ["external-library-linking"],
    });
  }
};
