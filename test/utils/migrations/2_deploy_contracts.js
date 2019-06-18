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
    const OrganizationFactory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'OrganizationFactory');
    const SegmentDirectory = Contracts.getFromNodeModules('@windingtree/wt-contracts', 'SegmentDirectory');
    await project.setImplementation(Organization, 'Organization');
    await project.setImplementation(OrganizationFactory, 'OrganizationFactory');
    await project.setImplementation(SegmentDirectory, 'SegmentDirectory');

    // setup the factory proxy
    const factory = await project.createProxy(OrganizationFactory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], project.getApp().address],
      from: accounts[4],
    });
    // create some 0xORGs
    const firstHotelEvent = await factory.methods.create('in-memory://hotel-url-one').send({ from: accounts[2] });
    const secondHotelEvent = await factory.methods.create('in-memory://hotel-url-two').send({ from: accounts[1] });
    const firstHotel = await Organization.at(firstHotelEvent.events.OrganizationCreated.returnValues.organization);
    const secondHotel = await Organization.at(secondHotelEvent.events.OrganizationCreated.returnValues.organization);
    const firstAirlineEvent = await factory.methods.create('in-memory://airline-url-one').send({ from: accounts[3] });
    const secondAirlineEvent = await factory.methods.create('in-memory://airline-url-two').send({ from: accounts[4] });
    const firstAirline = await Organization.at(firstAirlineEvent.events.OrganizationCreated.returnValues.organization);
    const secondAirline = await Organization.at(secondAirlineEvent.events.OrganizationCreated.returnValues.organization);

    // setup directories
    const firstHotelDirectory = await project.createProxy(SegmentDirectory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], 'hotels', LifTokenTest.address],
      from: accounts[4],
    });
    const secondHotelDirectory = await project.createProxy(SegmentDirectory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], 'hotels', LifTokenTest.address],
      from: accounts[4],
    });
    const firstAirlineDirectory = await project.createProxy(SegmentDirectory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], 'airlines', LifTokenTest.address],
      from: accounts[4],
    });
    const secondAirlineDirectory = await project.createProxy(SegmentDirectory, {
      initFunction: 'initialize',
      initArgs: [accounts[4], 'airlines', LifTokenTest.address],
      from: accounts[4],
    });

    await firstHotelDirectory.methods.add(firstHotel.address).send({ from: accounts[2], gas: 60000000 });
    await firstHotelDirectory.methods.add(secondHotel.address).send({ from: accounts[1], gas: 60000000 });
    await firstAirlineDirectory.methods.add(firstAirline.address).send({ from: accounts[3], gas: 60000000 });
    await firstAirlineDirectory.methods.add(secondAirline.address).send({ from: accounts[4], gas: 60000000 });
    // Add associateed key
    await firstHotel.methods.addAssociatedKey(accounts[3]).send({ from: accounts[2], gas: 60000000 });
    await firstAirline.methods.addAssociatedKey(accounts[4]).send({ from: accounts[3], gas: 60000000 });

    console.log('========================================');
    console.log('    Proxy owner:', accounts[4]);
    console.log('    Factory, Directory and Token owner:', accounts[0]);
    console.log('    Factory address:', factory.address);
    console.log('    Wallet account:', accounts[1]);
    console.log('    LifToken with faucet:', LifTokenTest.address);
    console.log('    HotelDirectory:', firstHotelDirectory.address);
    console.log('    Second HotelDirectory:', secondHotelDirectory.address);
    console.log('    First hotel', firstHotel.address);
    console.log('    Second hotel', secondHotel.address);
    console.log('    AirlineDirectory:', firstAirlineDirectory.address);
    console.log('    Second AirlineDirectory:', secondAirlineDirectory.address);
    console.log('    First airline', firstAirline.address);
    console.log('    Second airline', secondAirline.address);
  }
};
