const lib = require('zos-lib');

const LifTokenTest = artifacts.require('@windingtree/lif-token/LifTokenTest');

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    // First, we need the token contract with a faucet
    await deployer.deploy(LifTokenTest, { from: accounts[0], gas: 60000000 });

    // Setup a local copy of zos package for wt-contracts
    const ZWeb3 = lib.ZWeb3;
    ZWeb3.initialize(web3.currentProvider);
    const Contracts = lib.Contracts;
    Contracts.setArtifactsDefaults({
      gas: 6721975,
      gasPrice: 100000000000,
    });

    // setup the project with all the proxies
    const project = await lib.AppProject.fetchOrDeploy('wt-contracts', '0.0.1');
    const Organization = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'Organization');
    const Entrypoint = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'WindingTreeEntrypoint');
    const OrganizationFactory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'OrganizationFactory');
    const SegmentDirectory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'SegmentDirectory');
    await project.setImplementation(Entrypoint, 'WindingTreeEntrypoint');
    await project.setImplementation(Organization, 'Organization');
    await project.setImplementation(OrganizationFactory, 'OrganizationFactory');
    await project.setImplementation(SegmentDirectory, 'SegmentDirectory');

    // setup the factory proxy
    const factory = await project.createProxy(OrganizationFactory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], project.getApp().address],
      from: accounts[4],
    });
    // setup the entrypoint proxy
    const entrypoint = await project.createProxy(Entrypoint, {
      initFunction: 'initialize',
      initArgs: [accounts[4], LifTokenTest.address, factory.address],
      from: accounts[4],
    });

    // create some 0xORGs
    const firstHotelEvent = await factory.methods.create('in-memory://hotel-one').send({ from: accounts[2] });
    const secondHotelEvent = await factory.methods.create('in-memory://hotel-two').send({ from: accounts[1] });
    const firstHotel = await Organization.at(firstHotelEvent.events.OrganizationCreated.returnValues.organization);
    const secondHotel = await Organization.at(secondHotelEvent.events.OrganizationCreated.returnValues.organization);

    // setup directory
    const hotelDirectory = await project.createProxy(SegmentDirectory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], 'hotels', LifTokenTest.address],
      from: accounts[4],
    });

    const airlineDirectory = await project.createProxy(SegmentDirectory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], 'airlines', LifTokenTest.address],
      from: accounts[4],
    });

    await hotelDirectory.methods.add(firstHotel.address).send({ from: accounts[2], gas: 60000000 });
    await hotelDirectory.methods.add(secondHotel.address).send({ from: accounts[1], gas: 60000000 });
    // Add associateed key
    await firstHotel.methods.addAssociatedKey(accounts[3]).send({ from: accounts[2], gas: 60000000 });

    // Set entrypoint directories
    await entrypoint.methods.setSegment('airlines', airlineDirectory.address).send({ from: accounts[4], gas: 60000000 });
    await entrypoint.methods.setSegment('otas', airlineDirectory.address).send({ from: accounts[4], gas: 60000000 });
    await entrypoint.methods.setSegment('hotels', hotelDirectory.address).send({ from: accounts[4], gas: 60000000 });
    // gap testing in segment list
    await entrypoint.methods.removeSegment('otas').send({ from: accounts[4], gas: 60000000 });

    console.log('========================================');
    console.log('    Proxy owner:', accounts[4]);
    console.log('    Entrypoint, Factory, Directory and Token owner:', accounts[0]);
    console.log('    Entrypoint address:', entrypoint.address);
    console.log('    Factory address:', factory.address);
    console.log('    Wallet account:', accounts[1]);
    console.log('    LifToken with faucet:', LifTokenTest.address);
    console.log('    HotelDirectory:', hotelDirectory.address);
    console.log('    First hotel', firstHotel.address);
    console.log('    Second hotel', secondHotel.address);
  }
};
