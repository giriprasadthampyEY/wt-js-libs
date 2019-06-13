const LifTokenTest = artifacts.require('@windingtree/lif-token/LifTokenTest');
const HotelDirectory = artifacts.require('@windingtree/wt-contracts/SegmentDirectory');
const Organization = artifacts.require('@windingtree/wt-contracts/Organization');

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    let firstIndex, secondIndex;

    // First, we need the token contract with a faucet
    await deployer.deploy(LifTokenTest, { from: accounts[0], gas: 60000000 });
    // And then we setup the HotelDirectory
    
    await deployer.deploy(HotelDirectory, { from: accounts[0], gas: 60000000 });
    firstIndex = await HotelDirectory.deployed();
    await firstIndex.initialize(accounts[0], 'hotels', LifTokenTest.address, { from: accounts[0], gas: 60000000 });
    
    await deployer.deploy(HotelDirectory, { from: accounts[0], gas: 60000000 });
    secondIndex = await HotelDirectory.deployed();
    await secondIndex.initialize(accounts[0], 'hotels', LifTokenTest.address, { from: accounts[0], gas: 60000000 });

    const firstHotel = await firstIndex.createAndAdd('in-memory://hotel-url-one', { from: accounts[2], gas: 60000000 });
    await firstIndex.createAndAdd('in-memory://hotel-url-two', { from: accounts[1], gas: 60000000 });

    // Add a delegate
    const hotelContract = await Organization.at(firstHotel.logs[0].address);
    await hotelContract.addDelegate(accounts[3], { from: accounts[2], gas: 60000000 });

    const hotels = await firstIndex.getOrganizations();
    console.log('========================================');
    console.log('    Index and token owner:', accounts[0]);
    console.log('    Wallet account:', accounts[1]);
    console.log('    LifToken with faucet:', LifTokenTest.address);
    console.log('    HotelDirectory:', firstIndex.address);
    console.log('    Second HotelDirectory:', secondIndex.address);
    console.log('    First hotel', hotels[1]);
    console.log('    Second hotel', hotels[2]);
  }
};
