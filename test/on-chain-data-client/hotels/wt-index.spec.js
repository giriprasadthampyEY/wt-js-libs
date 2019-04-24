import { assert } from 'chai';
import sinon from 'sinon';
import { HotelDataModel } from '../../../src/on-chain-data-client/hotels/data-model';
import testedDataModel from '../../utils/data-hotel-model-definition';
import helpers from '../../utils/helpers';
import { WTLibsError } from '../../../src/errors';
import { SmartContractInstantiationError, HotelNotInstantiableError,
  HotelNotFoundError, RemoteDataReadError } from '../../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.hotels.WTHotelIndex', () => {
  let dataModel, indexDataProvider;

  beforeEach(async function () {
    dataModel = HotelDataModel.createInstance(testedDataModel.withDataSource().onChainDataOptions, {}, {
      getHotelIndexInstance: sinon.stub().resolves({
        methods: {
          getHotels: helpers.stubContractMethodResult([]),
          hotelsIndex: helpers.stubContractMethodResult(1),
        },
      }),
    });
    indexDataProvider = dataModel.getWindingTreeIndex(testedDataModel.indexAddress);
  });

  it('should throw when we want index from a bad address', async () => {
    try {
      indexDataProvider.web3Contracts.getHotelIndexInstance = sinon.stub().rejects(new SmartContractInstantiationError('Cannot get hotelIndex instance at an address with no code on 1234'));
      await indexDataProvider._getDeployedIndex();
      assert(false);
    } catch (e) {
      assert.match(e.message, /cannot get hotelIndex instance/i);
      assert.instanceOf(e, SmartContractInstantiationError);
    }
  });

  describe('getHotel', () => {
    it('should throw if address is malformed', async () => {
      try {
        indexDataProvider.web3Contracts.getHotelIndexInstance = sinon.stub().resolves({
          methods: {
            hotelsIndex: {
              call: sinon.stub().rejects(),
            },
          },
        });
        await indexDataProvider.getHotel('random-address');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw if no hotel exists on that address', async () => {
      try {
        indexDataProvider.web3Contracts.getHotelIndexInstance = sinon.stub().resolves({
          methods: {
            hotelsIndex: helpers.stubContractMethodResult(0),
          },
        });
        await indexDataProvider.getHotel('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, HotelNotFoundError);
      }
    });

    it('should throw if hotel contract cannot be instantiated', async () => {
      try {
        sinon.stub(indexDataProvider, '_createRecordInstanceFactory').rejects();
        await indexDataProvider.getHotel('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, HotelNotInstantiableError);
      } finally {
        indexDataProvider._createRecordInstanceFactory.restore();
      }
    });

    it('should throw if accessing off-chain data without resolved on-chain pointer and on-chain pointer cannot be downloaded', async () => {
      // pre-heat the contract so we can stub it later
      await indexDataProvider._getDeployedIndex();
      sinon.stub(indexDataProvider.deployedIndex.methods, 'hotelsIndex').returns({
        call: sinon.stub().resolves('7'),
      });
      // There is not a valid hotel on this address
      const address = '0x994afd347b160be3973b41f0a144819496d175e9';
      const hotel = await indexDataProvider.getHotel(address);

      try {
        await hotel.dataIndex;
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot sync remote data/i);
        assert.instanceOf(e, RemoteDataReadError);
      } finally {
        indexDataProvider.deployedIndex.methods.hotelsIndex.restore();
      }
    });
  });

  describe('getAllHotels', () => {
    it('should call getAllRecords', async () => {
      const callStub = sinon.spy(indexDataProvider, 'getAllRecords');
      await indexDataProvider.getAllHotels();
      assert.equal(callStub.callCount, 1);
      indexDataProvider.getAllRecords.restore();
    });
  });

  describe('transferHotelOwnership', () => {
    it('should call transferRecordOwnership', async () => {
      const callStub = sinon.stub(indexDataProvider, 'transferRecordOwnership').resolves(true);
      await indexDataProvider.transferHotelOwnership({}, '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
      assert.equal(callStub.callCount, 1);
      indexDataProvider.transferRecordOwnership.restore();
    });
  });

  describe('addHotel', () => {
    it('should call addRecord', async () => {
      const callStub = sinon.stub(indexDataProvider, 'addRecord').resolves(true);
      await indexDataProvider.addHotel({});
      assert.equal(callStub.callCount, 1);
      indexDataProvider.addRecord.restore();
    });
  });

  describe('updateHotel', () => {
    it('should call updateRecord', async () => {
      const callStub = sinon.stub(indexDataProvider, 'updateRecord').resolves(true);
      await indexDataProvider.updateHotel({});
      assert.equal(callStub.callCount, 1);
      indexDataProvider.updateRecord.restore();
    });
  });

  describe('removeHotel', () => {
    it('should call removeRecord', async () => {
      const callStub = sinon.stub(indexDataProvider, 'removeRecord').resolves(true);
      await indexDataProvider.removeHotel('0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
      assert.equal(callStub.callCount, 1);
      indexDataProvider.removeRecord.restore();
    });
  });
});
