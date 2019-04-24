import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../../utils/helpers';
import OnChainRecord from '../../../src/on-chain-data-client/wt-index/record';
import StoragePointer from '../../../src/on-chain-data-client/storage-pointer';
import { InputDataError, SmartContractInstantiationError } from '../../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.Record', () => {
  let contractsStub, createdStub, utilsStub, indexContractStub, urlStub, managerStub;
  const validUri = 'schema://new-url';
  const validManager = 'valid-manager';

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
    };
    urlStub = helpers.stubContractMethodResult('some-remote-url');
    managerStub = helpers.stubContractMethodResult('some-remote-manager');
    createdStub = helpers.stubContractMethodResult('created-block');
    contractsStub = {
      getHotelInstance: sinon.stub().resolves({
        methods: {
          dataUri: urlStub,
          manager: managerStub,
          created: createdStub,
          editInfo: helpers.stubContractMethodResult('info-edited'),
        },
      }),
      decodeLogs: sinon.stub().returns([{
        attributes: [{ value: '0xnew-hotel-address' }],
      }]),
    };
    indexContractStub = {
      options: {
        address: 'index-address',
      },
      methods: {
        callRecord: helpers.stubContractMethodResult('called-record'),
        registerRecord: helpers.stubContractMethodResult('registered-record'),
        deleteRecord: helpers.stubContractMethodResult('deleted-record'),
        transferRecord: helpers.stubContractMethodResult('transfer-record'),
      },
    };
  });

  describe('initialize', () => {
    it('should setup dataUri, manager and created fields', () => {
      const provider = new OnChainRecord(utilsStub, contractsStub, indexContractStub);
      assert.isUndefined(provider.dataUri);
      assert.isUndefined(provider.manager);
      assert.isUndefined(provider.created);
      provider.initialize();
      assert.isDefined(provider.dataUri);
      assert.isDefined(provider.manager);
      assert.isDefined(provider.created);
      assert.isFalse(provider.onChainDataset.isDeployed());
    });

    it('should mark eth backed dataset as deployed if address is passed', () => {
      const provider = new OnChainRecord(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.initialize();
      assert.isTrue(provider.onChainDataset.isDeployed());
    });
  });

  describe('abstraction', () => {
    let provider;

    beforeEach(() => {
      provider = new OnChainRecord(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.initialize();
    });

    it('should throw when _getStoragePointerLayoutFactory is accessed on abstract class', async () => {
      try {
        const provider = new OnChainRecord(utilsStub, contractsStub, indexContractStub);
        provider.initialize();
        await provider.dataIndex;
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getStoragePointerLayoutFactory/i);
      }
    });

    it('should throw when _getRecordContractFactory is accessed on abstract class', async () => {
      try {
        await provider._editInfoOnChain({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _getRecordContractFactory/i);
      }
    });

    it('should throw when _callRecordInIndexFactory is accessed on abstract class', async () => {
      try {
        provider._getRecordContractFactory = sinon.stub().resolves({
          methods: {
            editInfo: sinon.stub().returns({
              encodeABI: sinon.stub().returns('aaa'),
            }),
            dataUri: sinon.stub().returns({
              call: sinon.stub().resolves('data-uri'),
            }),
            manager: sinon.stub().returns({
              call: sinon.stub().resolves('manager'),
            }),
            created: sinon.stub().returns({
              call: sinon.stub().resolves('created'),
            }),
          },
        });
        await provider._editInfoOnChain({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _callRecordInIndexFactory/i);
      }
    });

    it('should throw when _registerRecordInIndexFactory is accessed on abstract class', async () => {
      try {
        provider._getRecordContractFactory = sinon.stub().resolves({
          methods: {
            dataUri: sinon.stub().returns({
              call: sinon.stub().resolves('data-uri'),
            }),
            manager: sinon.stub().returns({
              call: sinon.stub().resolves('manager'),
            }),
            created: sinon.stub().returns({
              call: sinon.stub().resolves('created'),
            }),
          },
        });
        await provider._createOnChainData({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _registerRecordInIndexFactory/i);
      }
    });

    it('should throw when _transferRecordInIndexFactory is accessed on abstract class', async () => {
      try {
        await provider._transferOnChainOwnership({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _transferRecordInIndexFactory/i);
      }
    });

    it('should throw when _deleteRecordInIndexFactory is accessed on abstract class', async () => {
      try {
        await provider._removeOnChainData({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _deleteRecordInIndexFactory/i);
      }
    });
  });

  describe('mocked data provider', () => {
    let provider;
    class MockedProvider extends OnChainRecord {
      _getStoragePointerLayoutFactory () {
        return {};
      }

      _getRecordContractFactory () {
        return {
          methods: {
            dataUri: urlStub,
            manager: managerStub,
            created: createdStub,
            editInfo: helpers.stubContractMethodResult('info-edited'),
          },
        };
      }

      _callRecordInIndexFactory (data) {
        return indexContractStub.methods.callRecord();
      }

      _registerRecordInIndexFactory (dataUri) {
        return indexContractStub.methods.registerRecord();
      }

      _transferRecordInIndexFactory (newManager) {
        return indexContractStub.methods.transferRecord();
      }

      _deleteRecordInIndexFactory () {
        return indexContractStub.methods.deleteRecord();
      }
    }
    beforeEach(() => {
      provider = new MockedProvider(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.RECORD_TYPE = 'dragon';
      provider.initialize();
    });

    describe('dataIndex', () => {
      it('should setup StoragePointer during the first access', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.dataUri = 'in-memory://something-new';
        assert.equal(storagePointerSpy.callCount, 0);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        assert.equal(storagePointerSpy.firstCall.args[0], 'in-memory://something-new');
        storagePointerSpy.restore();
      });

      it('should reuse StoragePointer instance in successive calls', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.dataUri = 'in-memory://something-new';
        assert.equal(storagePointerSpy.callCount, 0);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        storagePointerSpy.restore();
      });

      it('should drop current StoragePointer instance when dataUri changes via setLocalData', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.dataUri = 'in-memory://something-new';
        await provider.dataIndex;
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-new');
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.setLocalData({
          dataUri: 'in-memory://something-completely-different',
        });
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 2);
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-completely-different');
        storagePointerSpy.restore();
      });

      it('should drop current StoragePointer instance when dataUri changes via direct access', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.dataUri = 'in-memory://something-new';
        await provider.dataIndex;
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-new');
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        provider.dataUri = 'in-memory://something-completely-different';
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 2);
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-completely-different');
        storagePointerSpy.restore();
      });
    });

    describe('setLocalData', () => {
      it('should set dataUri', async () => {
        await provider.setLocalData({ dataUri: validUri });
        assert.equal(await provider.dataUri, validUri);
        await provider.setLocalData({ dataUri: 'schema://another-url' });
        assert.equal(await provider.dataUri, 'schema://another-url');
      });

      it('should never null dataUri', async () => {
        await provider.setLocalData({ dataUri: validUri });
        assert.equal(await provider.dataUri, validUri);
        await provider.setLocalData({ dataUri: null });
        assert.equal(await provider.dataUri, validUri);
      });

      it('should never set invalid dataUri', async () => {
        try {
          await provider.setLocalData({ dataUri: validUri });
          assert.equal(await provider.dataUri, validUri);
          await provider.setLocalData({ dataUri: 'invalid-url' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update dragon/i);
          assert.match(e.message, /cannot set dataUri with invalid format/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should allow dash in dataUri', async () => {
        await provider.setLocalData({ dataUri: validUri });
        assert.equal(await provider.dataUri, validUri);
        await provider.setLocalData({ dataUri: 'bzz-raw://valid-url' });
        assert.equal(await provider.dataUri, 'bzz-raw://valid-url');
      });

      it('should set manager only when not yet deployed', async () => {
        try {
          await provider.setLocalData({ manager: validManager });
          assert.equal(await provider.manager, validManager);
          provider.address = '0xsomething';
          await provider.setLocalData({ manager: 'another-manager' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update dragon/i);
          assert.match(e.message, /Cannot set manager when dragon is deployed/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should never null manager', async () => {
        provider = new MockedProvider(utilsStub, contractsStub, indexContractStub);
        provider.initialize();
        await provider.setLocalData({ manager: validManager });
        assert.equal(await provider.manager, validManager);
        await provider.setLocalData({ manager: null });
        assert.equal(await provider.manager, validManager);
      });
    });

    describe('setters', () => {
      it('should never null manager', async () => {
        try {
          provider.manager = null;
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set manager when it is not provided/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should never null dataUri', async () => {
        try {
          provider.dataUri = null;
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set dataUri when it is not provided/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should never set dataUri in a bad format', async () => {
        try {
          provider.dataUri = 'some-weird-uri';
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set dataUri with invalid format/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should reset dataIndex if dataUri changes', async () => {
        provider.dataUri = 'in-memory://something-else';
        assert.isNull(provider._dataIndex);
      });

      it('should not reset dataIndex if dataUri remains the same', async () => {
        provider = new MockedProvider(utilsStub, contractsStub, indexContractStub);
        provider.initialize();
        await provider.setLocalData({ dataUri: validUri, manager: validManager });
        provider.dataUri = await provider.dataUri;
        assert.isNull(provider._dataIndex);
      });
    });

    describe('toPlainObject', () => {
      it('should return a plain JS object', async () => {
        provider = new MockedProvider(utilsStub, contractsStub, indexContractStub);
        provider.initialize();
        await provider.setLocalData({ dataUri: validUri, manager: validManager });
        // initialize dataIndex so we're able to mock it later
        await provider.dataIndex;
        sinon.stub(provider._dataIndex, 'toPlainObject').resolves({
          ref: validUri,
          contents: {
            descriptionUri: {
              ref: validUri,
              contents: {},
            },
          },
        });
        const plainHotel = await provider.toPlainObject();
        assert.equal(plainHotel.manager, validManager);
        assert.isUndefined(plainHotel.toPlainObject);
        assert.equal(plainHotel.dataUri.ref, validUri);
        assert.isDefined(plainHotel.dataUri.contents);
        assert.isDefined(plainHotel.dataUri.contents.descriptionUri);
      });
    });

    describe('remote data definition', () => {
      it('should setup remoteGetter for dataUri', async () => {
        assert.equal(urlStub().call.callCount, 0);
        await provider.dataUri;
        assert.equal(urlStub().call.callCount, 1);
      });

      it('should setup remoteGetter for manager', async () => {
        assert.equal(managerStub().call.callCount, 0);
        await provider.manager;
        assert.equal(managerStub().call.callCount, 1);
      });
    });

    describe('_createOnChainData', () => {
      beforeEach(async () => {
        provider = new MockedProvider(utilsStub, contractsStub, indexContractStub);
        provider.initialize();
      });

      it('should return transaction metadata', async () => {
        const result = await provider._createOnChainData({ from: 'xx' });
        assert.isDefined(result.transactionData);
        assert.isDefined(result.record);
        assert.isDefined(result.eventCallbacks);
        assert.isDefined(result.eventCallbacks.onReceipt);
      });

      it('should apply gasCoefficient', async () => {
        await provider._createOnChainData({ from: 'xx' });
        assert.equal(utilsStub.applyGasModifier.callCount, 1);
        assert.equal(indexContractStub.methods.registerRecord().estimateGas.callCount, 1);
        assert.equal(indexContractStub.methods.registerRecord().encodeABI.callCount, 1);
        assert.equal(indexContractStub.methods.registerRecord().estimateGas.firstCall.args[0].from, 'xx');
      });

      it('should return eventCallback that will mark dataset as deployed', async () => {
        assert.isFalse(provider.onChainDataset.isDeployed());
        const result = await provider._createOnChainData({ from: 'xx' });
        result.eventCallbacks.onReceipt();
        assert.isTrue(provider.onChainDataset.isDeployed());
      });

      it('should return eventCallback that will parse receipt logs for contract address', async () => {
        assert.isFalse(provider.onChainDataset.isDeployed());
        const result = await provider._createOnChainData({ from: 'xx' });
        assert.isUndefined(await result.record.address);
        result.eventCallbacks.onReceipt({ logs: [{ some: 'logs' }] });
        assert.equal(await result.record.address, '0xnew-hotel-address');
      });
    });

    describe('_updateOnChainData', () => {
      let provider;
      beforeEach(async () => {
        provider = new MockedProvider(utilsStub, contractsStub, indexContractStub, 'fake-address');
        provider.initialize();
      });

      it('should throw on an undeployed contract', async () => {
        try {
          provider = new MockedProvider(utilsStub, contractsStub, indexContractStub);
          provider.initialize();
          await provider._updateOnChainData({});
          assert(false);
        } catch (e) {
          assert.match(e.message, /instance without address/i);
          assert.instanceOf(e, SmartContractInstantiationError);
        }
      });

      it('should throw when updating hotel without dataUri', async () => {
        try {
          provider.dataUri = null;
          await provider._updateOnChainData({});
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set dataUri when it is not provided/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should return transactions metadata', async () => {
        await provider.setLocalData({ dataUri: validUri });
        const result = await provider._updateOnChainData({ from: 'xx' });
        assert.equal(result.length, 1);
        assert.isDefined(result[0].transactionData);
        assert.isDefined(result[0].record);
        assert.isDefined(result[0].eventCallbacks);
        assert.isDefined(result[0].eventCallbacks.onReceipt);
      });

      it('should apply gasCoefficient', async () => {
        await provider.setLocalData({ dataUri: validUri });
        await provider._updateOnChainData({ from: 'xx' });
        assert.equal(utilsStub.applyGasModifier.callCount, 1);
        assert.equal(indexContractStub.methods.callRecord().estimateGas.callCount, 1);
        assert.equal(indexContractStub.methods.callRecord().encodeABI.callCount, 1);
        assert.equal(indexContractStub.methods.callRecord().estimateGas.firstCall.args[0].from, 'xx');
      });
    });

    describe('_transferOnChainOwnership', () => {
      let provider;
      beforeEach(async () => {
        provider = new MockedProvider(utilsStub, contractsStub, indexContractStub, 'fake-address');
        provider.RECORD_TYPE = 'dragon';
        provider.initialize();
      });

      it('should throw on an undeployed contract', async () => {
        try {
          provider.onChainDataset._deployedFlag = false;
          await provider._transferOnChainOwnership({});
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove dragon/i);
          assert.instanceOf(e, SmartContractInstantiationError);
        }
      });

      it('should return transaction metadata', async () => {
        const result = await provider._transferOnChainOwnership('new-manager', { from: 'xx' });
        assert.isDefined(result.transactionData);
        assert.isDefined(result.record);
        assert.isDefined(result.eventCallbacks);
        assert.isDefined(result.eventCallbacks.onReceipt);
      });

      it('should apply gasCoefficient', async () => {
        await provider._transferOnChainOwnership('new-manager', { from: 'xx' });
        assert.equal(utilsStub.applyGasModifier.callCount, 1);
        assert.equal(indexContractStub.methods.transferRecord().estimateGas.callCount, 1);
        assert.equal(indexContractStub.methods.transferRecord().encodeABI.callCount, 1);
        assert.equal(indexContractStub.methods.transferRecord().estimateGas.firstCall.args[0].from, 'xx');
      });

      it('should set manager', async () => {
        assert.equal(await provider.manager, 'some-remote-manager');
        const result = await provider._transferOnChainOwnership('new-manager', { from: 'xx' });
        result.eventCallbacks.onReceipt({ logs: [{ some: 'logs' }] });
        assert.equal(await provider.manager, 'new-manager');
      });
    });

    describe('_removeOnChainData', () => {
      let provider;
      beforeEach(async () => {
        provider = new MockedProvider(utilsStub, contractsStub, indexContractStub, 'fake-address');
        provider.RECORD_TYPE = 'dragon';
        provider.initialize();
      });

      it('should throw on an undeployed contract', async () => {
        try {
          provider.onChainDataset._deployedFlag = false;
          await provider._removeOnChainData({});
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot remove dragon/i);
          assert.instanceOf(e, SmartContractInstantiationError);
        }
      });

      it('should return transaction metadata', async () => {
        const result = await provider._removeOnChainData({ from: 'xx' });
        assert.isDefined(result.transactionData);
        assert.isDefined(result.record);
        assert.isDefined(result.eventCallbacks);
        assert.isDefined(result.eventCallbacks.onReceipt);
      });

      it('should apply gasCoefficient', async () => {
        await provider._removeOnChainData({ from: 'xx' });
        assert.equal(utilsStub.applyGasModifier.callCount, 1);
        assert.equal(indexContractStub.methods.deleteRecord().estimateGas.callCount, 1);
        assert.equal(indexContractStub.methods.deleteRecord().encodeABI.callCount, 1);
        assert.equal(indexContractStub.methods.deleteRecord().estimateGas.firstCall.args[0].from, 'xx');
      });

      it('should return eventCallback that will mark dataset as obsolete', async () => {
        assert.isFalse(provider.onChainDataset.isObsolete());
        const result = await provider._removeOnChainData({ from: 'xx' });
        result.eventCallbacks.onReceipt({ logs: [{ some: 'logs' }] });
        assert.isTrue(provider.onChainDataset.isObsolete());
      });
    });
  });
});
