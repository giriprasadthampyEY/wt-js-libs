import offChainData from './data/off-chain-data.json';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';

export const Web3UriBackedDataModel = {
  emptyConfig: {},
  withDataSource: () => ({
    segment: 'airlines',
    dataModelOptions: {
      provider: 'http://localhost:8545',
    },
    offChainDataOptions: {
      adapters: {
        'in-memory': {
          create: () => {
            return new InMemoryAdapter();
          },
        },
      },
    },
  }),
  indexAddress: '0xAc0fE06EC39F677f634F40D5DeE43440e433A5B7',
  emptyIndexAddress: '0x83Ec0A54244865Dc84de0c521f10b727aa34275a',
};

for (let key in offChainData) {
  InMemoryAdapter.storageInstance.update(key, offChainData[key]);
}

export default Web3UriBackedDataModel;
