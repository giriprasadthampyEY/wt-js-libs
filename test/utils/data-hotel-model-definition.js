import offChainData from './data/off-chain-data.json';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';

export const Web3UriBackedDataModel = {
  emptyConfig: {},
  withDataSource: () => ({
    onChainDataOptions: {
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
  entrypointAddress: '0x13a3381f7239909601b177e29739C442B8e858Fe',
};

for (const key in offChainData) {
  InMemoryAdapter.storageInstance.update(key, JSON.stringify(offChainData[key]));
}

export default Web3UriBackedDataModel;
