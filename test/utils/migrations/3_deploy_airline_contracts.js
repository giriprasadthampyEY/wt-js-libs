const LifTokenTest = artifacts.require('@windingtree/lif-token/LifTokenTest');
const WTAirlineIndex = artifacts.require('@windingtree/wt-contracts/WTAirlineIndex');

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    let firstIndex, secondIndex;

    // First, we need the token contract with a faucet
    await deployer.deploy(LifTokenTest, { from: accounts[3], gas: 60000000 });
    // And then we setup the WTAirlineIndex
    await deployer.deploy(WTAirlineIndex, { from: accounts[3], gas: 60000000 });
    firstIndex = await WTAirlineIndex.deployed();
    await firstIndex.initialize(accounts[3], LifTokenTest.address, { from: accounts[3], gas: 60000000 });
    await firstIndex.setLifToken(LifTokenTest.address, { from: accounts[3], gas: 60000000 });
    await deployer.deploy(WTAirlineIndex, { from: accounts[3], gas: 60000000 });
    secondIndex = await WTAirlineIndex.deployed();
    await secondIndex.initialize(accounts[3], LifTokenTest.address, { from: accounts[3], gas: 60000000 });
    await firstIndex.registerAirline('in-memory://airline-url-one', { from: accounts[2], gas: 60000000 });
    await firstIndex.registerAirline('in-memory://airline-url-two', { from: accounts[1], gas: 60000000 });

    const airlines = await firstIndex.getAirlines();
    console.log('========================================');
    console.log('    Index and token owner:', accounts[0]);
    console.log('    Wallet account:', accounts[1]);
    console.log('    LifToken with faucet:', LifTokenTest.address);
    console.log('    WTAirlineIndex:', firstIndex.address);
    console.log('    Second WTAirlineIndex:', secondIndex.address);
    console.log('    First airline', airlines[1]);
    console.log('    Second airline', airlines[2]);
  }
};
