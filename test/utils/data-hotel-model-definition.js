import offChainData from './data/off-chain-data.json';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';
import { HOTEL_SEGMENT_ID } from '../../src/on-chain-data-client/constants';

export const Web3UriBackedDataModel = {
  emptyConfig: {},
  withDataSource: () => ({
    segment: HOTEL_SEGMENT_ID,
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
  directoryAddress: '0x3f77813140ee53a99889D7E71c03D80f9F690eD4',
  emptyDirectoryAddress: '0xdd11EE2285da560FC7aAB5981c19104BA78D76b9',
};

for (let key in offChainData) {
  InMemoryAdapter.storageInstance.update(key, offChainData[key]);
}

export default Web3UriBackedDataModel;
