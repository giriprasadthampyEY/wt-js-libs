import { assert } from 'chai';
import sinon from 'sinon';
import WTIndexDataProvider from '../../../src/on-chain-data/airlines/wt-index';
import { AirlineDataModel } from '../../../src/on-chain-data/';
import testedDataModel from '../../utils/data-airline-model-definition';
import { WTLibsError } from '../../../src/errors';
import { SmartContractInstantiationError, AirlineNotInstantiableError, AirlineNotFoundError,
  RemoteDataReadError } from '../../../src/on-chain-data/errors';

describe('WTLibs.on-chain-data.airlines.WTAirlineIndex', () => {
  let dataModel, indexDataProvider;

  beforeEach(async function () {
    dataModel = AirlineDataModel.createInstance(testedDataModel.withDataSource().dataModelOptions);
    indexDataProvider = dataModel.getWindingTreeIndex(testedDataModel.indexAddress);
  });

  it('should throw when we want index from a bad address', async () => {
    const customIndexDataProvider = WTIndexDataProvider.createInstance('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', dataModel.web3Utils, dataModel.web3Contracts);
    try {
      await customIndexDataProvider._getDeployedIndex();
      throw new Error('should not have been called');
    } catch (e) {
      assert.match(e.message, /cannot get airlineIndex instance/i);
      assert.instanceOf(e, SmartContractInstantiationError);
    }
  });

  describe('getAirline', () => {
    it('should throw if address is malformed', async () => {
      try {
        await indexDataProvider.getAirline('random-address');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot find airline/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw if no airline exists on that address', async () => {
      try {
        await indexDataProvider.getAirline('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot find airline/i);
        assert.instanceOf(e, AirlineNotFoundError);
      }
    });

    it('should throw if airline contract cannot be instantiated', async () => {
      try {
        sinon.stub(indexDataProvider, '_createRecordInstanceFactory').rejects();
        await indexDataProvider.getAirline('0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot find airline/i);
        assert.instanceOf(e, AirlineNotInstantiableError);
      } finally {
        indexDataProvider._createRecordInstanceFactory.restore();
      }
    });

    it('should throw if accessing off-chain data without resolved on-chain pointer and on-chain pointer cannot be downloaded', async () => {
      // pre-heat the contract so we can stub it later
      await indexDataProvider._getDeployedIndex();
      sinon.stub(indexDataProvider.deployedIndex.methods, 'airlinesIndex').returns({
        call: sinon.stub().resolves('7'),
      });
      // There is not a valid airline on this address
      const address = '0x994afd347b160be3973b41f0a144819496d175e9';
      const airline = await indexDataProvider.getAirline(address);

      try {
        await airline.dataIndex;
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot sync remote data/i);
        assert.instanceOf(e, RemoteDataReadError);
      } finally {
        indexDataProvider.deployedIndex.methods.airlinesIndex.restore();
      }
    });
  });

  describe('getAllAirlines', () => {
    it('should call getAllRecords', async () => {
      const callStub = sinon.spy(indexDataProvider, 'getAllRecords');
      await indexDataProvider.getAllAirlines();
      assert.equal(callStub.callCount, 1);
      indexDataProvider.getAllRecords.restore();
    });
  });

  describe('transferAirlineOwnership', () => {
    it('should call transferRecordOwnership', async () => {
      const callStub = sinon.stub(indexDataProvider, 'transferRecordOwnership').resolves(true);
      await indexDataProvider.transferAirlineOwnership({}, '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
      assert.equal(callStub.callCount, 1);
      indexDataProvider.transferRecordOwnership.restore();
    });
  });

  describe('addAirline', () => {
    it('should call addRecord', async () => {
      const callStub = sinon.stub(indexDataProvider, 'addRecord').resolves(true);
      await indexDataProvider.addAirline({});
      assert.equal(callStub.callCount, 1);
      indexDataProvider.addRecord.restore();
    });
  });

  describe('updateAirline', () => {
    it('should call updateRecord', async () => {
      const callStub = sinon.stub(indexDataProvider, 'updateRecord').resolves(true);
      await indexDataProvider.updateAirline({});
      assert.equal(callStub.callCount, 1);
      indexDataProvider.updateRecord.restore();
    });
  });

  describe('removeAirline', () => {
    it('should call removeRecord', async () => {
      const callStub = sinon.stub(indexDataProvider, 'removeRecord').resolves(true);
      await indexDataProvider.removeAirline('0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
      assert.equal(callStub.callCount, 1);
      indexDataProvider.removeRecord.restore();
    });
  });
});
