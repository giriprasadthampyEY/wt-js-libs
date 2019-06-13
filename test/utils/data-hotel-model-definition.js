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
  directoryAddress: '0x8C2373842D5EA4Ce4Baf53f4175e5e42a364c59C',
  emptyDirectoryAddress: '0x994afd347B160be3973B41F0A144819496d175e9',
};

for (let key in offChainData) {
  InMemoryAdapter.storageInstance.update(key, offChainData[key]);
}

export default Web3UriBackedDataModel;
