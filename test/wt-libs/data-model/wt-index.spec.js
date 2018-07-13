import { assert } from 'chai';
import sinon from 'sinon';
import WTIndexDataProvider from '../../../src/data-model/wt-index';
import Web3UriDataModel from '../../../src/data-model/';
import testedDataModel from '../../utils/data-model-definition';

import { SmartContractInstantiationError, WTLibsError } from '../../../src/errors';

describe('WTLibs.data-models.WTIndexDataProvider', () => {
  let dataModel, indexDataProvider;

  beforeEach(async function () {
    dataModel = Web3UriDataModel.createInstance(testedDataModel.withDataSource().dataModelOptions);
    indexDataProvider = await dataModel.getWindingTreeIndex(testedDataModel.indexAddress);
  });

  it('should throw when we want index from a bad address', async () => {
    const customIndexDataProvider = await WTIndexDataProvider.createInstance('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
    try {
      await customIndexDataProvider._getDeployedIndex();
      throw new Error('should not have been called');
    } catch (e) {
      assert.match(e.message, /cannot get index instance/i);
      assert.instanceOf(e, SmartContractInstantiationError);
    }
  });

  describe('getHotel', () => {
    it('should throw if address is malformed', async () => {
      try {
        await indexDataProvider.getHotel('random-address');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw if no hotel exists on that address', async () => {
      try {
        await indexDataProvider.getHotel('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw if hotel contract cannot be instantiated', async () => {
      try {
        sinon.stub(indexDataProvider, '_createHotelInstance').rejects();
        await indexDataProvider.getHotel('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, WTLibsError);
      } finally {
        indexDataProvider._createHotelInstance.restore();
      }
    });
  });

  describe('addHotel', () => {
    it('should throw generic error when something does not work during tx data preparation', async () => {
      try {
        sinon.stub(indexDataProvider, '_createHotelInstance').resolves({
          setLocalData: sinon.stub().resolves(),
          createOnChainData: sinon.stub().rejects(),
        });
        await indexDataProvider.addHotel({ manager: 'b', dataUri: 'aaa' });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot add hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });
  });

  describe('updateHotel', () => {
    it('should throw generic error when something does not work during tx data preparation', async () => {
      try {
        const hotel = await indexDataProvider.getHotel('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        sinon.stub(hotel, 'updateOnChainData').rejects('some original error');
        await indexDataProvider.updateHotel(hotel);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.instanceOf(e, WTLibsError);
        assert.isDefined(e.originalError);
        assert.equal(e.originalError.name, 'some original error');
      }
    });
  });

  describe('removeHotel', () => {
    it('should throw generic error when something does not work during tx data preparation', async () => {
      try {
        const hotel = await indexDataProvider.getHotel('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        sinon.stub(hotel, 'removeOnChainData').rejects();
        await indexDataProvider.removeHotel(hotel);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot remove hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw error when trying to remove a hotel without manager', async () => {
      try {
        const hotel = await indexDataProvider.getHotel('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        hotel._manager = null;
        await indexDataProvider.removeHotel(hotel);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot remove hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });
  });

  describe('getAllHotels', () => {
    it('should not panic when one of many hotels is missing on-chain', async () => {
      await indexDataProvider._getDeployedIndex();
      const getHotelSpy = sinon.spy(indexDataProvider, 'getHotel');
      sinon.stub(indexDataProvider.deployedIndex.methods, 'getHotels').returns({
        call: sinon.stub().resolves([
          '0x0000000000000000000000000000000000000000', // This is an empty address
          '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769',
          '0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', // This is not an address of a hotel
        ]),
      });
      const hotels = await indexDataProvider.getAllHotels();
      // Attempting to get two hotels for two valid addresses
      assert.equal(getHotelSpy.callCount, 2);
      // But we know there's only one actual hotel
      assert.equal(hotels.length, 1);
      indexDataProvider.deployedIndex.methods.getHotels.restore();
      getHotelSpy.restore();
    });
  });
});
