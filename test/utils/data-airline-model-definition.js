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
  directoryAddress: '0x13a3381f7239909601b177e29739C442B8e858Fe',
  emptyDirectoryAddress: '0x8C51716A18CF4FBF12437EdC010fDBE2E51Fd934',
  factoryAddress: '0xC0FF9Ef6071BEEBeADf5Cb40fFf84Cf40A5C3CCB',
};

for (let key in offChainData) {
  InMemoryAdapter.storageInstance.update(key, offChainData[key]);
}

export default Web3UriBackedDataModel;
