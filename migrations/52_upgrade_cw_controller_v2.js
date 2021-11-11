const { upgradeProxy } = require("@openzeppelin/truffle-upgrades");

const CWController = artifacts.require("CWController");

module.exports = async function (deployer, network, accounts) {
  if (network === "bscmainnet") {
    const proxyAddress = "0xAadfa537ecA54d3d7655C4117bBFB83B9bF6035a";
    await upgradeProxy(proxyAddress, CWController, {
      deployer,
    });

    const controller = await CWController.at(proxyAddress);
    const router ="0x10ed43c718714eb63d5aa57b78b54704e256024e";
    const busdAddress= "0xe9e7cea3dedca5984780bafc599bd69add087d56";
    const xBladeAddress = "0x27a339d9b59b21390d7209b78a839868e319301b";
    await controller.migrate_v2(router, xBladeAddress, busdAddress);
  }
};
