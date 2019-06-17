import offChainData from './data/off-chain-data.json';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';
import { AIRLINE_SEGMENT_ID } from '../../src/on-chain-data-client/constants';

export const Web3UriBackedDataModel = {
  emptyConfig: {},
  withDataSource: () => ({
    segment: AIRLINE_SEGMENT_ID,
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
};

for (let key in offChainData) {
  InMemoryAdapter.storageInstance.update(key, offChainData[key]);
}

export default Web3UriBackedDataModel;
