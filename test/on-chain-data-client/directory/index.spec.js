import { assert } from 'chai';
import sinon from 'sinon';
import AbstractDirectory from '../../../src/on-chain-data-client/directory';
import helpers from '../../utils/helpers';
import { HotelDataModel } from '../../../src/on-chain-data-client/hotels/data-model';
import testedDataModel from '../../utils/data-hotel-model-definition';
import { WTLibsError } from '../../../src/errors';
import { RecordNotFoundError, RecordNotInstantiableError,
  InputDataError } from '../../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.AbstractDirectory', () => {
  let dataModel;

  beforeAll(function () {
    dataModel = HotelDataModel.createInstance(testedDataModel.withDataSource().onChainDataOptions, {
      isZeroAddress: sinon.stub().callsFake((addr) => {
        return addr === '0x0000000000000000000000000000000000000000' || !addr.startsWith('0x');
      }),
    }, {
      getHotelDirectoryInstance: sinon.stub().resolves({
        methods: {
          getOrganizations: helpers.stubContractMethodResult([]),
          organizationsIndex: helpers.stubContractMethodResult(1),
        },
      }),
    });
  });

  describe('abstraction', () => {
    it('should throw when _getDeployedDirectoryFactory is called on an abstract class', async () => {
      try {
        const directory = new AbstractDirectory('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await directory._getDeployedDirectory();
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getDeployedDirectoryFactory/i);
      }
    });

    it('should throw when _createRecordInstanceFactory is called on an abstract class', async () => {
      try {
        const directory = new AbstractDirectory('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await directory.addRecord({
          orgJsonUri: '1234',
          owner: '1234',
        });
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _createRecordInstanceFactory/i);
      }
    });

    it('should throw when _getDirectoryRecordPositionFactory is called on an abstract class', async () => {
      try {
        const directory = new AbstractDirectory('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await directory.getRecord();
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getDirectoryRecordPositionFactory/i);
      }
    });

    it('should throw when _getRecordsAddressListFactory is called on an abstract class', async () => {
      try {
        const directory = new AbstractDirectory('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await directory.getOrganizations();
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getRecordsAddressListFactory/i);
      }
    });
  });

  describe('mocked data provider', () => {
    let directoryProvider;

    beforeEach(async function () {
      class ImplClass extends AbstractDirectory {
        async _getDeployedDirectoryFactory () {
          return Promise.resolve({
            methods: {
              LifToken: sinon.stub().returns({
                call: sinon.stub().resolves('0xAd84405aeF5d241E1BB264f0a58E238e221d70dE'),
              }),
            },
          });
        }

        async _createRecordInstanceFactory (address) {
          return Promise.resolve({
            setLocalData: sinon.stub().resolves(true),
            createOnChainData: sinon.stub().resolves(true),
            updateOnChainData: sinon.stub().resolves(true),
          });
        }

        async _getDirectoryRecordPositionFactory (address) {
          return Promise.resolve(1);
        }

        async _getRecordsAddressListFactory () {
          return Promise.resolve([
            '0x0000000000000000000000000000000000000000',
            '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
          ]);
        }
      };
      directoryProvider = new ImplClass('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
      directoryProvider.RECORD_TYPE = 'dragon';
    });

    describe('getRecord', () => {
      it('should throw if address is malformed', async () => {
        try {
          sinon.stub(directoryProvider, '_getDirectoryRecordPositionFactory').rejects();
          await directoryProvider.getRecord('random-address');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot find dragon/i);
          assert.instanceOf(e, WTLibsError);
        }
      });

      it('should throw if no record exists on that address', async () => {
        try {
          sinon.stub(directoryProvider, '_getDirectoryRecordPositionFactory').resolves(0);
          await directoryProvider.getRecord('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot find dragon/i);
          assert.instanceOf(e, RecordNotFoundError);
        }
      });

      it('should throw if record contract cannot be instantiated', async () => {
        try {
          sinon.stub(directoryProvider, '_createRecordInstanceFactory').rejects();
          await directoryProvider.getRecord('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot find dragon/i);
          assert.instanceOf(e, RecordNotInstantiableError);
        } finally {
          directoryProvider._createRecordInstanceFactory.restore();
        }
      });
    });

    describe('addRecord', () => {
      it('should throw generic error when something does not work during tx data preparation', async () => {
        try {
          sinon.stub(directoryProvider, '_createRecordInstanceFactory').resolves({
            setLocalData: sinon.stub().resolves(),
            createOnChainData: sinon.stub().rejects(),
          });
          await directoryProvider.addRecord({ owner: 'b', orgJsonUri: 'aaa' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot add dragon/i);
          assert.instanceOf(e, WTLibsError);
        } finally {
          directoryProvider._createRecordInstanceFactory.restore();
        }
      });

      it('should throw when orgJsonUri is not provided', async () => {
        try {
          await directoryProvider.addRecord({ owner: 'b' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot add dragon/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should throw when owner is not provided', async () => {
        try {
          await directoryProvider.addRecord({ orgJsonUri: 'b' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot add dragon/i);
          assert.instanceOf(e, InputDataError);
        }
      });
    });

    describe('updateRecord', () => {
      it('should throw generic error when something does not work during tx data preparation', async () => {
        try {
          await directoryProvider.updateRecord({
            owner: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
            address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
            updateOnChainData: sinon.stub().rejects('some original error'),
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update dragon/i);
          assert.instanceOf(e, WTLibsError);
          assert.isDefined(e.originalError);
          assert.equal(e.originalError.name, 'some original error');
        }
      });

      it('should throw when owner is not provided', async () => {
        try {
          await directoryProvider.updateRecord({ address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769', orgJsonUri: 'b' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update dragon/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should throw when address is not provided', async () => {
        try {
          await directoryProvider.updateRecord({ orgJsonUri: 'b', owner: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update dragon/i);
          assert.instanceOf(e, InputDataError);
        }
      });
    });

    describe('removeRecord', () => {
      it('should throw generic error when something does not work during tx data preparation', async () => {
        try {
          await directoryProvider.removeRecord({
            removeOnChainData: sinon.stub().rejects(),
            owner: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
            address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove dragon/i);
          assert.instanceOf(e, WTLibsError);
        }
      });

      it('should throw error when trying to remove a hotel without owner', async () => {
        try {
          await directoryProvider.removeRecord({
            address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove dragon/i);
          assert.instanceOf(e, WTLibsError);
        }
      });

      it('should throw error when trying to remove a hotel without address', async () => {
        try {
          await directoryProvider.removeRecord({
            owner: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove dragon/i);
          assert.instanceOf(e, WTLibsError);
        }
      });
    });

    describe('getOrganizations', () => {
      it('should not panic when one of many records is missing on-chain', async () => {
        directoryProvider._createRecordInstanceFactory = sinon.stub()
          .callsFake((addr) => {
            return addr === '0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA' ? Promise.reject(new Error()) : Promise.resolve({
              addr,
            });
          });
        directoryProvider._getRecordsAddressListFactory = sinon.stub().resolves([
          '0x0000000000000000000000000000000000000000', // This is an empty address
          '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769',
          '0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', // This is not an address of a hotel
        ]);
        const records = await directoryProvider.getOrganizations();
        // Attempting to get two hotels for two valid addresses
        assert.equal(directoryProvider._createRecordInstanceFactory.callCount, 2);
        // But we know there's only one actual hotel
        assert.equal(records.length, 1);
      });
    });

    describe('getLifTokenAddress', () => {
      it('should return LifToken address', async () => {
        const tokenAddress = await directoryProvider.getLifTokenAddress();
        assert.equal(tokenAddress, '0xAd84405aeF5d241E1BB264f0a58E238e221d70dE');
      });
    });
  });
});
