const LifTokenTest = artifacts.require('@windingtree/lif-token/LifTokenTest');
const AirlineDirectory = artifacts.require('@windingtree/wt-contracts/SegmentDirectory');
const Organization = artifacts.require('@windingtree/wt-contracts/Organization');

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    let firstIndex, secondIndex;

    // First, we need the token contract with a faucet
    await deployer.deploy(LifTokenTest, { from: accounts[3], gas: 60000000 });
    // And then we setup the AirlineDirectory
    await deployer.deploy(AirlineDirectory, { from: accounts[3], gas: 60000000 });
    firstIndex = await AirlineDirectory.deployed();
    await firstIndex.initialize(accounts[3], 'airlines', LifTokenTest.address, { from: accounts[3], gas: 60000000 });
    // await firstIndex.setLifToken(LifTokenTest.address, { from: accounts[3], gas: 60000000 });
    await deployer.deploy(AirlineDirectory, { from: accounts[3], gas: 60000000 });
    secondIndex = await AirlineDirectory.deployed();
    await secondIndex.initialize(accounts[3], 'airlines', LifTokenTest.address, { from: accounts[3], gas: 60000000 });
    const firstAirline = await firstIndex.createAndAdd('in-memory://airline-url-one', { from: accounts[3], gas: 60000000 });
    await firstIndex.createAndAdd('in-memory://airline-url-two', { from: accounts[1], gas: 60000000 });

    // Add a delegate
    const airlineContract = await Organization.at(firstAirline.logs[0].address);
    await airlineContract.addDelegate(accounts[4], { from: accounts[3], gas: 60000000 });

    const airlines = await firstIndex.getOrganizations();
    console.log('========================================');
    console.log('    Index and token owner:', accounts[0]);
    console.log('    Wallet account:', accounts[1]);
    console.log('    LifToken with faucet:', LifTokenTest.address);
    console.log('    AirlineDirectory:', firstIndex.address);
    console.log('    Second AirlineDirectory:', secondIndex.address);
    console.log('    First airline', airlines[1]);
    console.log('    Second airline', airlines[2]);
  }
};
