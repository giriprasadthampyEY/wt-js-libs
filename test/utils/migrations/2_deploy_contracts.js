const LifTokenTest = artifacts.require('@windingtree/lif-token/LifTokenTest');
const WTHotelIndex = artifacts.require('@windingtree/wt-contracts/WTHotelIndex');

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    let firstIndex, secondIndex;

    // First, we need the token contract with a faucet
    await deployer.deploy(LifTokenTest, { from: accounts[0], gas: 60000000 });
    // And then we setup the WTHotelIndex
    
    await deployer.deploy(WTHotelIndex, { from: accounts[0], gas: 60000000 });
    firstIndex = await WTHotelIndex.deployed();
    await firstIndex.initialize(accounts[0], LifTokenTest.address, { from: accounts[0], gas: 60000000 });
    
    await deployer.deploy(WTHotelIndex, { from: accounts[0], gas: 60000000 });
    secondIndex = await WTHotelIndex.deployed();
    await secondIndex.initialize(accounts[0], LifTokenTest.address, { from: accounts[0], gas: 60000000 });
    
    await firstIndex.registerHotel('in-memory://hotel-url-one', { from: accounts[2], gas: 60000000 });
    await firstIndex.registerHotel('in-memory://hotel-url-two', { from: accounts[1], gas: 60000000 });

    const hotels = await firstIndex.getHotels();
    console.log('========================================');
    console.log('    Index and token owner:', accounts[0]);
    console.log('    Wallet account:', accounts[1]);
    console.log('    LifToken with faucet:', LifTokenTest.address);
    console.log('    WTHotelIndex:', firstIndex.address);
    console.log('    Second WTHotelIndex:', secondIndex.address);
    console.log('    First hotel', hotels[1]);
    console.log('    Second hotel', hotels[2]);
  }
};
