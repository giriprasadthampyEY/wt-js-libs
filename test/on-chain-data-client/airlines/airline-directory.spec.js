import { assert } from 'chai';
import sinon from 'sinon';
import { AirlineDataModel } from '../../../src/on-chain-data-client/airlines/data-model';
import testedDataModel from '../../utils/data-airline-model-definition';
import helpers from '../../utils/helpers';
import { WTLibsError } from '../../../src/errors';
import { SmartContractInstantiationError, AirlineNotInstantiableError, AirlineNotFoundError,
  RemoteDataReadError } from '../../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.airlines.spec.js.AirlineDirectory', () => {
  let dataModel, directoryProvider;

  beforeEach(async function () {
    dataModel = AirlineDataModel.createInstance(testedDataModel.withDataSource().onChainDataOptions, {}, {
      getAirlineDirectoryInstance: sinon.stub().resolves({
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
      directoryProvider.web3Contracts.getAirlineDirectoryInstance = sinon.stub().rejects(new SmartContractInstantiationError('Cannot get airline directory instance at an address with no code on 1234'));
      await directoryProvider._getDeployedDirectory();
      assert(false);
    } catch (e) {
      assert.match(e.message, /cannot get airline directory instance/i);
      assert.instanceOf(e, SmartContractInstantiationError);
    }
  });

  describe('getOrganization', () => {
    it('should throw if address is malformed', async () => {
      try {
        directoryProvider.web3Contracts.getAirlineDirectoryInstance = sinon.stub().resolves({
          methods: {
            organizationsIndex: {
              call: sinon.stub().rejects(),
            },
          },
        });
        await directoryProvider.getOrganization('random-address');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find airline/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw if no airline exists on that address', async () => {
      try {
        directoryProvider.web3Contracts.getAirlineDirectoryInstance = sinon.stub().resolves({
          methods: {
            organizationsIndex: helpers.stubContractMethodResult(0),
          },
        });
        await directoryProvider.getOrganization('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find airline/i);
        assert.instanceOf(e, AirlineNotFoundError);
      }
    });

    it('should throw if airline contract cannot be instantiated', async () => {
      try {
        sinon.stub(directoryProvider, '_createRecordInstanceFactory').rejects();
        await directoryProvider.getOrganization('0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find airline/i);
        assert.instanceOf(e, AirlineNotInstantiableError);
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
      // There is not a valid airline on this address
      const address = '0x994afd347b160be3973b41f0a144819496d175e9';
      const airline = await directoryProvider.getOrganization(address);

      try {
        await airline.dataIndex;
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
