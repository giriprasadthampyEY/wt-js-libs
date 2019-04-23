import { assert } from 'chai';
import sinon from 'sinon';
import AbstractWTIndex from '../../../../src/on-chain-data/wt-index';

import { HotelDataModel } from '../../../../src/on-chain-data/';
import testedDataModel from '../../../utils/data-hotel-model-definition';

import { WTLibsError } from '../../../../src/errors';
import { RecordNotFoundError, RecordNotInstantiableError,
  InputDataError } from '../../../../src/on-chain-data/errors';

describe('WTLibs.on-chain-data.hotels.AbstractWTIndex', () => {
  let dataModel;

  beforeAll(function () {
    dataModel = HotelDataModel.createInstance(testedDataModel.withDataSource().dataModelOptions);
  });

  describe('abstraction', () => {
    it('should throw when _getDeployedIndexFactory is called on an abstract class', async () => {
      try {
        const index = new AbstractWTIndex('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await index._getDeployedIndex();
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getDeployedIndexFactory/i);
      }
    });

    it('should throw when _createRecordInstanceFactory is called on an abstract class', async () => {
      try {
        const index = new AbstractWTIndex('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await index.addRecord({
          dataUri: '1234',
          manager: '1234',
        });
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _createRecordInstanceFactory/i);
      }
    });

    it('should throw when _getIndexRecordPositionFactory is called on an abstract class', async () => {
      try {
        const index = new AbstractWTIndex('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await index.getRecord();
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getIndexRecordPositionFactory/i);
      }
    });

    it('should throw when _getRecordsAddressListFactory is called on an abstract class', async () => {
      try {
        const index = new AbstractWTIndex('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
        await index.getAllRecords();
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getRecordsAddressListFactory/i);
      }
    });
  });

  describe('mocked data provider', () => {
    let indexDataProvider;

    beforeEach(async function () {
      class ImplClass extends AbstractWTIndex {
        async _getDeployedIndexFactory () {
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

        async _getIndexRecordPositionFactory (address) {
          return Promise.resolve(1);
        }

        async _getRecordsAddressListFactory () {
          return Promise.resolve([
            '0x0000000000000000000000000000000000000000',
            '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
          ]);
        }
      };
      indexDataProvider = new ImplClass('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
      indexDataProvider.RECORD_TYPE = 'mana';
    });

    describe('getRecord', () => {
      it('should throw if address is malformed', async () => {
        try {
          sinon.stub(indexDataProvider, '_getIndexRecordPositionFactory').rejects();
          await indexDataProvider.getRecord('random-address');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot find mana/i);
          assert.instanceOf(e, WTLibsError);
        }
      });

      it('should throw if no record exists on that address', async () => {
        try {
          sinon.stub(indexDataProvider, '_getIndexRecordPositionFactory').resolves(0);
          await indexDataProvider.getRecord('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot find mana/i);
          assert.instanceOf(e, RecordNotFoundError);
        }
      });

      it('should throw if record contract cannot be instantiated', async () => {
        try {
          sinon.stub(indexDataProvider, '_createRecordInstanceFactory').rejects();
          await indexDataProvider.getRecord('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot find mana/i);
          assert.instanceOf(e, RecordNotInstantiableError);
        } finally {
          indexDataProvider._createRecordInstanceFactory.restore();
        }
      });
    });

    describe('addRecord', () => {
      it('should throw generic error when something does not work during tx data preparation', async () => {
        try {
          sinon.stub(indexDataProvider, '_createRecordInstanceFactory').resolves({
            setLocalData: sinon.stub().resolves(),
            createOnChainData: sinon.stub().rejects(),
          });
          await indexDataProvider.addRecord({ manager: 'b', dataUri: 'aaa' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot add mana/i);
          assert.instanceOf(e, WTLibsError);
        }
      });

      it('should throw when dataUri is not provided', async () => {
        try {
          await indexDataProvider.addRecord({ manager: 'b' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot add mana/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should throw when manager is not provided', async () => {
        try {
          await indexDataProvider.addRecord({ dataUri: 'b' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot add mana/i);
          assert.instanceOf(e, InputDataError);
        }
      });
    });

    describe('updateRecord', () => {
      it('should throw generic error when something does not work during tx data preparation', async () => {
        try {
          await indexDataProvider.updateRecord({
            manager: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
            address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
            updateOnChainData: sinon.stub().rejects('some original error'),
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update mana/i);
          assert.instanceOf(e, WTLibsError);
          assert.isDefined(e.originalError);
          assert.equal(e.originalError.name, 'some original error');
        }
      });

      it('should throw when manager is not provided', async () => {
        try {
          await indexDataProvider.updateRecord({ address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769', dataUri: 'b' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update mana/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should throw when address is not provided', async () => {
        try {
          await indexDataProvider.updateRecord({ dataUri: 'b', manager: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update mana/i);
          assert.instanceOf(e, InputDataError);
        }
      });
    });

    describe('removeRecord', () => {
      it('should throw generic error when something does not work during tx data preparation', async () => {
        try {
          await indexDataProvider.removeRecord({
            removeOnChainData: sinon.stub().rejects(),
            manager: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
            address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove mana/i);
          assert.instanceOf(e, WTLibsError);
        }
      });

      it('should throw error when trying to remove a hotel without manager', async () => {
        try {
          await indexDataProvider.removeRecord({
            address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove mana/i);
          assert.instanceOf(e, WTLibsError);
        }
      });

      it('should throw error when trying to remove a hotel without address', async () => {
        try {
          await indexDataProvider.removeRecord({
            manager: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
          });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove mana/i);
          assert.instanceOf(e, WTLibsError);
        }
      });
    });

    describe('transferRecordOwnership', () => {
      it('should throw generic error when something does not work during tx data preparation', async () => {
        try {
          await indexDataProvider.transferRecordOwnership({
            transferOnChainOwnership: sinon.stub().rejects('some original error'),
            address: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
            manager: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
          }, '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot transfer mana/i);
          assert.instanceOf(e, WTLibsError);
          assert.isDefined(e.originalError);
          assert.equal(e.originalError.name, 'some original error');
        }
      });

      it('should throw when trying to transfer to an invalid address', async () => {
        try {
          await indexDataProvider.transferRecordOwnership({
            transferOnChainOwnership: sinon.stub().rejects('some original error'),
            address: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
            manager: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
          }, 'random-string-that-is-not-address');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot transfer mana/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should throw when trying to transfer a hotel without a manager', async () => {
        try {
          await indexDataProvider.transferRecordOwnership({
            transferOnChainOwnership: sinon.stub().rejects('some original error'),
            address: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
          }, '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot transfer mana/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should throw when trying to transfer a hotel without an address', async () => {
        try {
          await indexDataProvider.transferRecordOwnership({
            transferOnChainOwnership: sinon.stub().rejects('some original error'),
            manager: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
          }, '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot transfer mana/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should throw when transferring to the same manager', async () => {
        try {
          await indexDataProvider.transferRecordOwnership({
            transferOnChainOwnership: sinon.stub().rejects('some original error'),
            address: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
            manager: '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8',
          }, '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot transfer mana/i);
          assert.match(e.message, /same manager/i);
          assert.instanceOf(e, InputDataError);
        }
      });
    });

    describe('getAllRecords', () => {
      it('should not panic when one of many records is missing on-chain', async () => {
        indexDataProvider._createRecordInstanceFactory = sinon.stub()
          .callsFake((addr) => {
            return addr === '0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA' ? Promise.reject(new Error()) : Promise.resolve({
              addr,
            });
          });
        indexDataProvider._getRecordsAddressListFactory = sinon.stub().resolves([
          '0x0000000000000000000000000000000000000000', // This is an empty address
          '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769',
          '0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', // This is not an address of a hotel
        ]);
        const records = await indexDataProvider.getAllRecords();
        // Attempting to get two hotels for two valid addresses
        assert.equal(indexDataProvider._createRecordInstanceFactory.callCount, 2);
        // But we know there's only one actual hotel
        assert.equal(records.length, 1);
      });
    });

    describe('getLifTokenAddress', () => {
      it('should return LifToken address', async () => {
        const tokenAddress = await indexDataProvider.getLifTokenAddress();
        assert.equal(tokenAddress, '0xAd84405aeF5d241E1BB264f0a58E238e221d70dE');
      });
    });
  });
});
