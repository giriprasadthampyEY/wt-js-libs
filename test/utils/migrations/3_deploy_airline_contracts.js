const TruffleContract = require('truffle-contract');
const Web3 = require('web3');
const provider = new Web3.providers.HttpProvider('http://localhost:8545');

function getContractWithProvider (metadata, provider) {
  let contract = new TruffleContract(metadata);
  contract.setProvider(provider);
  return contract;
}

const LifTokenTest = getContractWithProvider(require('@windingtree/lif-token/build/contracts/LifTokenTest'), provider);
const WTAirlineIndex = getContractWithProvider(require('@windingtree/wt-contracts/build/contracts/WTAirlineIndex'), provider);

module.exports = async function (deployer, network, accounts) {
  if (network === 'development') {
    let firstIndex, secondIndex;

    // First, we need the token contract with a faucet
    await deployer.deploy(LifTokenTest, { from: accounts[3], gas: 60000000 });
    // And then we setup the WTAirlineIndex
    await deployer.deploy(WTAirlineIndex, { from: accounts[3], gas: 60000000 });
    firstIndex = await WTAirlineIndex.deployed();
    await firstIndex.setLifToken(LifTokenTest.address, { from: accounts[3], gas: 60000000 });
    await deployer.deploy(WTAirlineIndex, { from: accounts[3], gas: 60000000 });
    secondIndex = await WTAirlineIndex.deployed();
    await secondIndex.setLifToken(LifTokenTest.address, { from: accounts[3], gas: 60000000 });
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
