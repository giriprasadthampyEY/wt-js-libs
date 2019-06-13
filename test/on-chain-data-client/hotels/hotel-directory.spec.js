import { assert } from 'chai';
import sinon from 'sinon';
import { HotelDataModel } from '../../../src/on-chain-data-client/hotels/data-model';
import testedDataModel from '../../utils/data-hotel-model-definition';
import helpers from '../../utils/helpers';
import { WTLibsError } from '../../../src/errors';
import { SmartContractInstantiationError, HotelNotInstantiableError,
  HotelNotFoundError, RemoteDataReadError } from '../../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.hotels.HotelDirectory', () => {
  let dataModel, directoryProvider;

  beforeEach(async function () {
    dataModel = HotelDataModel.createInstance(testedDataModel.withDataSource().onChainDataOptions, {}, {
      getHotelDirectoryInstance: sinon.stub().resolves({
        methods: {
          getOrganizations: helpers.stubContractMethodResult([]),
          organizationsIndex: helpers.stubContractMethodResult(1),
        },
      }),
    });
    directoryProvider = dataModel.getDirectory(testedDataModel.directoryAddress);
  });

  it('should throw when we want directory from a bad address', async () => {
    try {
      directoryProvider.web3Contracts.getHotelDirectoryInstance = sinon.stub().rejects(new SmartContractInstantiationError('Cannot get hotel directory instance at an address with no code on 1234'));
      await directoryProvider._getDeployedDirectory();
      assert(false);
    } catch (e) {
      assert.match(e.message, /cannot get hotel directory instance/i);
      assert.instanceOf(e, SmartContractInstantiationError);
    }
  });

  describe('getRecord', () => {
    it('should throw if address is malformed', async () => {
      try {
        directoryProvider.web3Contracts.getHotelDirectoryInstance = sinon.stub().resolves({
          methods: {
            organizationsIndex: {
              call: sinon.stub().rejects(),
            },
          },
        });
        await directoryProvider.getRecord('random-address');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw if no hotel exists on that address', async () => {
      try {
        directoryProvider.web3Contracts.getHotelDirectoryInstance = sinon.stub().resolves({
          methods: {
            organizationsIndex: helpers.stubContractMethodResult(0),
          },
        });
        await directoryProvider.getRecord('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, HotelNotFoundError);
      }
    });

    it('should throw if hotel contract cannot be instantiated', async () => {
      try {
        sinon.stub(directoryProvider, '_createRecordInstanceFactory').rejects();
        await directoryProvider.getRecord('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, HotelNotInstantiableError);
      } finally {
        directoryProvider._createRecordInstanceFactory.restore();
      }
    });

    it('should throw if accessing off-chain data without resolved on-chain pointer and on-chain pointer cannot be downloaded', async () => {
      // pre-heat the contract so we can stub it later
      await directoryProvider._getDeployedDirectory();
      sinon.stub(directoryProvider.deployedDirectory.methods, 'organizationsIndex').returns({
        call: sinon.stub().resolves('7'),
      });
      // There is not a valid hotel on this address
      const address = '0x994afd347b160be3973b41f0a144819496d175e9';
      const hotel = await directoryProvider.getRecord(address);

      try {
        await hotel.dataIndex;
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot sync remote data/i);
        assert.instanceOf(e, RemoteDataReadError);
      } finally {
        directoryProvider.deployedDirectory.methods.organizationsIndex.restore();
      }
    });
  });

  describe('getOrganizations', () => {
    it('should call getOrganizations', async () => {
      const callStub = sinon.spy(directoryProvider, 'getOrganizations');
      await directoryProvider.getOrganizations();
      assert.equal(callStub.callCount, 1);
      directoryProvider.getOrganizations.restore();
    });
  });

  describe('add', () => {
    it('should call add', async () => {
      const callStub = sinon.stub(directoryProvider, 'add').resolves(true);
      await directoryProvider.add({});
      assert.equal(callStub.callCount, 1);
      directoryProvider.add.restore();
    });
  });

  describe('update', () => {
    it('should call update', async () => {
      const callStub = sinon.stub(directoryProvider, 'update').resolves(true);
      await directoryProvider.update({});
      assert.equal(callStub.callCount, 1);
      directoryProvider.update.restore();
    });
  });

  describe('remove', () => {
    it('should call remove', async () => {
      const callStub = sinon.stub(directoryProvider, 'remove').resolves(true);
      await directoryProvider.remove('0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
      assert.equal(callStub.callCount, 1);
      directoryProvider.remove.restore();
    });
  });
});
