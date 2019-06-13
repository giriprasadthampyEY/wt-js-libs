import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../../utils/helpers';
import OnChainRecord from '../../../src/on-chain-data-client/directory/record';
import StoragePointer from '../../../src/on-chain-data-client/storage-pointer';
import { InputDataError, SmartContractInstantiationError } from '../../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.Record', () => {
  let contractsStub, createdStub, utilsStub, directoryContractStub, urlStub, ownerStub;
  const validUri = 'schema://new-url';
  const validOwner = 'valid-owner';

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
    };
    urlStub = helpers.stubContractMethodResult('some-remote-url');
    ownerStub = helpers.stubContractMethodResult('some-remote-owner');
    createdStub = helpers.stubContractMethodResult('created-block');
    contractsStub = {
      getOrganizationInstance: sinon.stub().resolves({
        methods: {
          getOrgJsonUri: urlStub,
          owner: ownerStub,
          created: createdStub,
          editInfo: helpers.stubContractMethodResult('info-edited'),
        },
      }),
      decodeLogs: sinon.stub().returns([{
        attributes: [{ value: '0xnew-hotel-address' }],
      }]),
    };
    directoryContractStub = {
      options: {
        address: 'directory-address',
      },
      methods: {
        callRecord: helpers.stubContractMethodResult('called-record'),
        registerRecord: helpers.stubContractMethodResult('registered-record'),
        deleteRecord: helpers.stubContractMethodResult('deleted-record'),
      },
    };
  });

  describe('initialize', () => {
    it('should setup orgJsonUri, owner and created fields', () => {
      const provider = new OnChainRecord(utilsStub, contractsStub, directoryContractStub);
      assert.isUndefined(provider.orgJsonUri);
      assert.isUndefined(provider.owner);
      assert.isUndefined(provider.created);
      provider.initialize();
      assert.isDefined(provider.orgJsonUri);
      assert.isDefined(provider.owner);
      assert.isDefined(provider.created);
      assert.isFalse(provider.onChainDataset.isDeployed());
    });

    it('should mark eth backed dataset as deployed if address is passed', () => {
      const provider = new OnChainRecord(utilsStub, contractsStub, directoryContractStub, 'fake-address');
      provider.initialize();
      assert.isTrue(provider.onChainDataset.isDeployed());
    });
  });

  describe('abstraction', () => {
    let provider;

    beforeEach(() => {
      provider = new OnChainRecord(utilsStub, contractsStub, directoryContractStub, 'fake-address');
      provider.initialize();
    });

    it('should throw when _getStoragePointerLayoutFactory is accessed on abstract class', async () => {
      try {
        const provider = new OnChainRecord(utilsStub, contractsStub, directoryContractStub);
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

    it('should throw when _changeOrgJsonUriFactory is accessed on abstract class', async () => {
      try {
        provider._getRecordContractFactory = sinon.stub().resolves({
          methods: {
            editInfo: sinon.stub().returns({
              encodeABI: sinon.stub().returns('aaa'),
            }),
            getOrgJsonUri: sinon.stub().returns({
              call: sinon.stub().resolves('data-uri'),
            }),
            owner: sinon.stub().returns({
              call: sinon.stub().resolves('owner'),
            }),
            created: sinon.stub().returns({
              call: sinon.stub().resolves('created'),
            }),
          },
        });
        await provider._editInfoOnChain({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _callRecordInDirectoryFactory/i);
      }
    });

    it('should throw when _registerRecordInDirectoryFactory is accessed on abstract class', async () => {
      try {
        provider._getRecordContractFactory = sinon.stub().resolves({
          methods: {
            getOrgJsonUri: sinon.stub().returns({
              call: sinon.stub().resolves('data-uri'),
            }),
            owner: sinon.stub().returns({
              call: sinon.stub().resolves('owner'),
            }),
            created: sinon.stub().returns({
              call: sinon.stub().resolves('created'),
            }),
          },
        });
        await provider._createOnChainData({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _registerRecordInDirectoryFactory/i);
      }
    });

    it('should throw when _deleteRecordInDirectoryFactory is accessed on abstract class', async () => {
      try {
        await provider._removeOnChainData({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /Cannot call _deleteRecordInDirectoryFactory/i);
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
            getOrgJsonUri: urlStub,
            owner: ownerStub,
            created: createdStub,
            editInfo: helpers.stubContractMethodResult('info-edited'),
          },
        };
      }

      _changeOrgJsonUriFactory (data) {
        return directoryContractStub.methods.callRecord();
      }

      _registerRecordInDirectoryFactory (orgJsonUri) {
        return directoryContractStub.methods.registerRecord();
      }

      _deleteRecordInDirectoryFactory () {
        return directoryContractStub.methods.deleteRecord();
      }
    }
    beforeEach(() => {
      provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub, 'fake-address');
      provider.RECORD_TYPE = 'dragon';
      provider.initialize();
    });

    describe('dataIndex', () => {
      it('should setup StoragePointer during the first access', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.orgJsonUri = 'in-memory://something-new';
        assert.equal(storagePointerSpy.callCount, 0);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        assert.equal(storagePointerSpy.firstCall.args[0], 'in-memory://something-new');
        storagePointerSpy.restore();
      });

      it('should reuse StoragePointer instance in successive calls', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.orgJsonUri = 'in-memory://something-new';
        assert.equal(storagePointerSpy.callCount, 0);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        storagePointerSpy.restore();
      });

      it('should drop current StoragePointer instance when orgJsonUri changes via setLocalData', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.orgJsonUri = 'in-memory://something-new';
        await provider.dataIndex;
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-new');
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.setLocalData({
          orgJsonUri: 'in-memory://something-completely-different',
        });
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 2);
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-completely-different');
        storagePointerSpy.restore();
      });

      it('should drop current StoragePointer instance when orgJsonUri changes via direct access', async () => {
        const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
        provider.orgJsonUri = 'in-memory://something-new';
        await provider.dataIndex;
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-new');
        assert.equal(storagePointerSpy.callCount, 1);
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 1);
        provider.orgJsonUri = 'in-memory://something-completely-different';
        await provider.dataIndex;
        assert.equal(storagePointerSpy.callCount, 2);
        assert.equal((await provider.dataIndex).ref, 'in-memory://something-completely-different');
        storagePointerSpy.restore();
      });
    });

    describe('setLocalData', () => {
      it('should set orgJsonUri', async () => {
        await provider.setLocalData({ orgJsonUri: validUri });
        assert.equal(await provider.orgJsonUri, validUri);
        await provider.setLocalData({ orgJsonUri: 'schema://another-url' });
        assert.equal(await provider.orgJsonUri, 'schema://another-url');
      });

      it('should never null orgJsonUri', async () => {
        await provider.setLocalData({ orgJsonUri: validUri });
        assert.equal(await provider.orgJsonUri, validUri);
        await provider.setLocalData({ orgJsonUri: null });
        assert.equal(await provider.orgJsonUri, validUri);
      });

      it('should never set invalid orgJsonUri', async () => {
        try {
          await provider.setLocalData({ orgJsonUri: validUri });
          assert.equal(await provider.orgJsonUri, validUri);
          await provider.setLocalData({ orgJsonUri: 'invalid-url' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update dragon/i);
          assert.match(e.message, /cannot set orgJsonUri with invalid format/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should allow dash in orgJsonUri', async () => {
        await provider.setLocalData({ orgJsonUri: validUri });
        assert.equal(await provider.orgJsonUri, validUri);
        await provider.setLocalData({ orgJsonUri: 'bzz-raw://valid-url' });
        assert.equal(await provider.orgJsonUri, 'bzz-raw://valid-url');
      });

      it('should set owner only when not yet deployed', async () => {
        try {
          await provider.setLocalData({ owner: validOwner });
          assert.equal(await provider.owner, validOwner);
          provider.address = '0xsomething';
          await provider.setLocalData({ owner: 'another-owner' });
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot update dragon/i);
          assert.match(e.message, /Cannot set owner when dragon is deployed/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should never null owner', async () => {
        provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub);
        provider.initialize();
        await provider.setLocalData({ owner: validOwner });
        assert.equal(await provider.owner, validOwner);
        await provider.setLocalData({ owner: null });
        assert.equal(await provider.owner, validOwner);
      });
    });

    describe('setters', () => {
      it('should never null owner', async () => {
        try {
          provider.owner = null;
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set owner when it is not provided/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should never null orgJsonUri', async () => {
        try {
          provider.orgJsonUri = null;
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set orgJsonUri when it is not provided/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should never set orgJsonUri in a bad format', async () => {
        try {
          provider.orgJsonUri = 'some-weird-uri';
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set orgJsonUri with invalid format/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should reset dataIndex if orgJsonUri changes', async () => {
        provider.orgJsonUri = 'in-memory://something-else';
        assert.isNull(provider._dataIndex);
      });

      it('should not reset dataIndex if orgJsonUri remains the same', async () => {
        provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub);
        provider.initialize();
        await provider.setLocalData({ orgJsonUri: validUri, owner: validOwner });
        provider.orgJsonUri = await provider.orgJsonUri;
        assert.isNull(provider._dataIndex);
      });
    });

    describe('toPlainObject', () => {
      it('should return a plain JS object', async () => {
        provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub);
        provider.initialize();
        await provider.setLocalData({ orgJsonUri: validUri, owner: validOwner });
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
        assert.equal(plainHotel.owner, validOwner);
        assert.isUndefined(plainHotel.toPlainObject);
        assert.equal(plainHotel.orgJsonUri.ref, validUri);
        assert.isDefined(plainHotel.orgJsonUri.contents);
        assert.isDefined(plainHotel.orgJsonUri.contents.descriptionUri);
      });
    });

    describe('remote data definition', () => {
      it('should setup remoteGetter for orgJsonUri', async () => {
        assert.equal(urlStub().call.callCount, 0);
        await provider.orgJsonUri;
        assert.equal(urlStub().call.callCount, 1);
      });

      it('should setup remoteGetter for owner', async () => {
        assert.equal(ownerStub().call.callCount, 0);
        await provider.owner;
        assert.equal(ownerStub().call.callCount, 1);
      });
    });

    describe('_createOnChainData', () => {
      beforeEach(async () => {
        provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub);
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
        assert.equal(directoryContractStub.methods.registerRecord().estimateGas.callCount, 1);
        assert.equal(directoryContractStub.methods.registerRecord().encodeABI.callCount, 1);
        assert.equal(directoryContractStub.methods.registerRecord().estimateGas.firstCall.args[0].from, 'xx');
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
        provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub, 'fake-address');
        provider.initialize();
      });

      it('should throw on an undeployed contract', async () => {
        try {
          provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub);
          provider.initialize();
          await provider._updateOnChainData({});
          assert(false);
        } catch (e) {
          assert.match(e.message, /instance without address/i);
          assert.instanceOf(e, SmartContractInstantiationError);
        }
      });

      it('should throw when updating hotel without orgJsonUri', async () => {
        try {
          provider.orgJsonUri = null;
          await provider._updateOnChainData({});
          assert(false);
        } catch (e) {
          assert.match(e.message, /cannot set orgJsonUri when it is not provided/i);
          assert.instanceOf(e, InputDataError);
        }
      });

      it('should return transactions metadata', async () => {
        await provider.setLocalData({ orgJsonUri: validUri });
        const result = await provider._updateOnChainData({ from: 'xx' });
        assert.equal(result.length, 1);
        assert.isDefined(result[0].transactionData);
        assert.isDefined(result[0].record);
        assert.isDefined(result[0].eventCallbacks);
        assert.isDefined(result[0].eventCallbacks.onReceipt);
      });

      it('should apply gasCoefficient', async () => {
        await provider.setLocalData({ orgJsonUri: validUri });
        await provider._updateOnChainData({ from: 'xx' });
        assert.equal(utilsStub.applyGasModifier.callCount, 1);
        assert.equal(directoryContractStub.methods.callRecord().estimateGas.callCount, 1);
        assert.equal(directoryContractStub.methods.callRecord().encodeABI.callCount, 1);
        assert.equal(directoryContractStub.methods.callRecord().estimateGas.firstCall.args[0].from, 'xx');
      });
    });

    describe('_removeOnChainData', () => {
      let provider;
      beforeEach(async () => {
        provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub, 'fake-address');
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
        assert.equal(directoryContractStub.methods.deleteRecord().estimateGas.callCount, 1);
        assert.equal(directoryContractStub.methods.deleteRecord().encodeABI.callCount, 1);
        assert.equal(directoryContractStub.methods.deleteRecord().estimateGas.firstCall.args[0].from, 'xx');
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
