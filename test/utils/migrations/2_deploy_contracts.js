const TruffleContract = require('truffle-contract');
const Web3 = require('web3');
const provider = new Web3.providers.HttpProvider('http://localhost:8545');

function getContractWithProvider (metadata, provider) {
  let contract = new TruffleContract(metadata);
  contract.setProvider(provider);
  return contract;
}

const LifTokenTest = getContractWithProvider(require('@windingtree/lif-token/build/contracts/LifTokenTest'), provider);
const WTIndex = getContractWithProvider(require('@windingtree/wt-contracts/build/contracts/WTIndex'), provider);

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    let firstIndex, secondIndex;

    // First, we need the token contract with a faucet
    await deployer.deploy(LifTokenTest, { from: accounts[0], gas: 60000000 });
    // And then we setup the WTIndex
    await deployer.deploy(WTIndex, { from: accounts[0], gas: 60000000 });
    firstIndex = await WTIndex.deployed();
    await firstIndex.setLifToken(LifTokenTest.address, { from: accounts[0], gas: 60000000 });
    await deployer.deploy(WTIndex, { from: accounts[0], gas: 60000000 });
    secondIndex = await WTIndex.deployed();
    await secondIndex.setLifToken(LifTokenTest.address, { from: accounts[0], gas: 60000000 });
    await firstIndex.registerHotel('in-memory://urlone', { from: accounts[2], gas: 60000000 });
    await firstIndex.registerHotel('in-memory://urltwo', { from: accounts[1], gas: 60000000 });

    const hotels = firstIndex.getHotels();
    console.log('========================================');
    console.log('    Index and token owner:', accounts[0]);
    console.log('    Wallet account:', accounts[1]);
    console.log('    LifToken with faucet:', LifTokenTest.address);
    console.log('    WTIndex:', firstIndex.address);
    console.log('    Second WTIndex:', secondIndex.address);
    console.log('    First hotel', hotels[1]);
    console.log('    Second hotel', hotels[2]);
  }
};
