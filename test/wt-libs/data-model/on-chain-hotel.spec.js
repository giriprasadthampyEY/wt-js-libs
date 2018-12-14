import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../../utils/helpers';
import OnChainHotel from '../../../src/data-model/on-chain-hotel';
import StoragePointer from '../../../src/storage-pointer';

import { InputDataError, SmartContractInstantiationError } from '../../../src/errors';

describe('WTLibs.data-model.OnChainHotel', () => {
  let contractsStub, utilsStub, indexContractStub, urlStub, managerStub;
  const validUri = 'schema://new-url';
  const validManager = 'manager';

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
    };
    urlStub = helpers.stubContractMethodResult('some-remote-url');
    managerStub = helpers.stubContractMethodResult('some-remote-manager');
    contractsStub = {
      getHotelInstance: sinon.stub().resolves({
        methods: {
          dataUri: urlStub,
          manager: managerStub,
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
        callHotel: helpers.stubContractMethodResult('called-hotel'),
        registerHotel: helpers.stubContractMethodResult('registered-hotel'),
        deleteHotel: helpers.stubContractMethodResult('deleted-hotel'),
        transferHotel: helpers.stubContractMethodResult('transfer-hotel'),
      },
    };
  });

  describe('initialize', () => {
    it('should setup dataUri and manager fields', () => {
      const provider = new OnChainHotel(utilsStub, contractsStub, indexContractStub);
      assert.isUndefined(provider.dataUri);
      assert.isUndefined(provider.manager);
      provider.initialize();
      assert.isDefined(provider.dataUri);
      assert.isDefined(provider.manager);
      assert.isFalse(provider.onChainDataset.isDeployed());
    });

    it('should mark eth backed dataset as deployed if address is passed', () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      assert.isTrue(provider.onChainDataset.isDeployed());
    });
  });

  describe('dataIndex', () => {
    it('should setup StoragePointer during the first access', async () => {
      const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.dataUri = 'in-memory://something-new';
      assert.equal(storagePointerSpy.callCount, 0);
      await provider.dataIndex;
      assert.equal(storagePointerSpy.callCount, 1);
      assert.equal(storagePointerSpy.firstCall.args[0], 'in-memory://something-new');
      storagePointerSpy.restore();
    });

    it('should reuse StoragePointer instance in successive calls', async () => {
      const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
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
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
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
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
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
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      await provider.setLocalData({ dataUri: validUri, manager: validManager });
      assert.equal(await provider.dataUri, validUri);
      await provider.setLocalData({ dataUri: 'schema://another-url', manager: validManager });
      assert.equal(await provider.dataUri, 'schema://another-url');
    });

    it('should never null dataUri', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      await provider.setLocalData({ dataUri: validUri, manager: validManager });
      assert.equal(await provider.dataUri, validUri);
      await provider.setLocalData({ dataUri: null, manager: validManager });
      assert.equal(await provider.dataUri, validUri);
    });

    it('should never set invalid dataUri', async () => {
      try {
        const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.setLocalData({ dataUri: validUri, manager: validManager });
        assert.equal(await provider.dataUri, validUri);
        await provider.setLocalData({ dataUri: 'invalid-url', manager: validManager });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.match(e.message, /cannot set dataUri with invalid format/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should allow dash in dataUri', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      await provider.setLocalData({ dataUri: validUri, manager: validManager });
      assert.equal(await provider.dataUri, validUri);
      await provider.setLocalData({ dataUri: 'bzz-raw://valid-url', manager: validManager });
      assert.equal(await provider.dataUri, 'bzz-raw://valid-url');
    });

    it('should set manager only when not yet deployed', async () => {
      try {
        const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.setLocalData({ manager: validManager, dataUri: validUri });
        assert.equal(await provider.manager, validManager);
        provider.address = '0xsomething';
        await provider.setLocalData({ manager: 'another-manager', dataUri: validUri });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.match(e.message, /Cannot set manager when hotel is deployed/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should never null manager', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      await provider.setLocalData({ manager: validManager, dataUri: validUri });
      assert.equal(await provider.manager, validManager);
      await provider.setLocalData({ manager: null, dataUri: validUri });
      assert.equal(await provider.manager, validManager);
    });
  });

  describe('setters', () => {
    it('should never null manager', async () => {
      try {
        const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        provider.manager = null;
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot set manager to null/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should never null dataUri', async () => {
      try {
        const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        provider.dataUri = null;
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot set dataUri when it is not provided/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should never set dataUri in a bad format', async () => {
      try {
        const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        provider.dataUri = 'some-weird-uri';
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot set dataUri with invalid format/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should reset dataIndex if dataUri changes', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      provider.dataUri = 'in-memory://something-else';
      assert.isNull(provider._dataIndex);
    });

    it('should not reset dataIndex if dataUri remains the same', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      await provider.setLocalData({ dataUri: validUri, manager: validManager });
      provider.dataUri = await provider.dataUri;
      assert.isNull(provider._dataIndex);
    });
  });

  describe('toPlainObject', () => {
    it('should return a plain JS object', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
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
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      assert.equal(urlStub().call.callCount, 0);
      await provider.dataUri;
      assert.equal(urlStub().call.callCount, 1);
    });

    it('should setup remoteGetter for manager', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      assert.equal(managerStub().call.callCount, 0);
      await provider.manager;
      assert.equal(managerStub().call.callCount, 1);
    });
  });

  describe('createOnChainData', () => {
    let provider;
    beforeEach(async () => {
      provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
    });

    it('should return transaction metadata', async () => {
      const result = await provider.createOnChainData({ from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.hotel);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
    });

    it('should apply gasCoefficient', async () => {
      await provider.createOnChainData({ from: 'xx' });
      assert.equal(utilsStub.applyGasModifier.callCount, 1);
      assert.equal(indexContractStub.methods.registerHotel().estimateGas.callCount, 1);
      assert.equal(indexContractStub.methods.registerHotel().encodeABI.callCount, 1);
      assert.equal(indexContractStub.methods.registerHotel().estimateGas.firstCall.args[0].from, 'xx');
    });

    it('should return eventCallback that will mark dataset as deployed', async () => {
      assert.isFalse(provider.onChainDataset.isDeployed());
      const result = await provider.createOnChainData({ from: 'xx' });
      result.eventCallbacks.onReceipt();
      assert.isTrue(provider.onChainDataset.isDeployed());
    });

    it('should return eventCallback that will parse receipt logs for contract address', async () => {
      assert.isFalse(provider.onChainDataset.isDeployed());
      const result = await provider.createOnChainData({ from: 'xx' });
      assert.isUndefined(await result.hotel.address);
      result.eventCallbacks.onReceipt({ logs: [{ some: 'logs' }] });
      assert.equal(await result.hotel.address, '0xnew-hotel-address');
    });
  });

  describe('updateOnChainData', () => {
    let provider;
    beforeEach(async () => {
      provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.dataUri = validUri;
    });

    it('should throw on an undeployed contract', async () => {
      try {
        let provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.updateOnChainData({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot get hotel/i);
        assert.instanceOf(e, SmartContractInstantiationError);
      }
    });

    it('should throw when updating hotel without dataUri', async () => {
      try {
        provider.dataUri = null;
        await provider.updateOnChainData({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot set dataUri when it is not provided/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should return transactions metadata', async () => {
      const result = await provider.updateOnChainData({ from: 'xx' });
      assert.equal(result.length, 1);
      assert.isDefined(result[0].transactionData);
      assert.isDefined(result[0].hotel);
      assert.isDefined(result[0].eventCallbacks);
      assert.isDefined(result[0].eventCallbacks.onReceipt);
    });

    it('should apply gasCoefficient', async () => {
      await provider.updateOnChainData({ from: 'xx' });
      assert.equal(utilsStub.applyGasModifier.callCount, 1);
      assert.equal(indexContractStub.methods.callHotel().estimateGas.callCount, 1);
      assert.equal(indexContractStub.methods.callHotel().encodeABI.callCount, 1);
      assert.equal(indexContractStub.methods.callHotel().estimateGas.firstCall.args[0].from, 'xx');
    });
  });

  describe('transferOnChainOwnership', () => {
    let provider;
    beforeEach(async () => {
      provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
    });

    it('should throw on an undeployed contract', async () => {
      try {
        provider.onChainDataset._deployedFlag = false;
        await provider.transferOnChainOwnership({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot remove hotel/i);
        assert.instanceOf(e, SmartContractInstantiationError);
      }
    });

    it('should return transaction metadata', async () => {
      const result = await provider.transferOnChainOwnership('new-manager', { from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.hotel);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
    });

    it('should apply gasCoefficient', async () => {
      await provider.transferOnChainOwnership('new-manager', { from: 'xx' });
      assert.equal(utilsStub.applyGasModifier.callCount, 1);
      assert.equal(indexContractStub.methods.transferHotel().estimateGas.callCount, 1);
      assert.equal(indexContractStub.methods.transferHotel().encodeABI.callCount, 1);
      assert.equal(indexContractStub.methods.transferHotel().estimateGas.firstCall.args[0].from, 'xx');
    });

    it('should set manager', async () => {
      assert.equal(await provider.manager, 'some-remote-manager');
      const result = await provider.transferOnChainOwnership('new-manager', { from: 'xx' });
      result.eventCallbacks.onReceipt({ logs: [{ some: 'logs' }] });
      assert.equal(await provider.manager, 'new-manager');
    });
  });

  describe('removeOnChainData', () => {
    let provider;
    beforeEach(async () => {
      provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
    });

    it('should throw on an undeployed contract', async () => {
      try {
        provider.onChainDataset._deployedFlag = false;
        await provider.removeOnChainData({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot remove hotel/i);
        assert.instanceOf(e, SmartContractInstantiationError);
      }
    });

    it('should return transaction metadata', async () => {
      const result = await provider.removeOnChainData({ from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.hotel);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
    });

    it('should apply gasCoefficient', async () => {
      await provider.removeOnChainData({ from: 'xx' });
      assert.equal(utilsStub.applyGasModifier.callCount, 1);
      assert.equal(indexContractStub.methods.deleteHotel().estimateGas.callCount, 1);
      assert.equal(indexContractStub.methods.deleteHotel().encodeABI.callCount, 1);
      assert.equal(indexContractStub.methods.deleteHotel().estimateGas.firstCall.args[0].from, 'xx');
    });

    it('should return eventCallback that will mark dataset as obsolete', async () => {
      assert.isFalse(provider.onChainDataset.isObsolete());
      const result = await provider.removeOnChainData({ from: 'xx' });
      result.eventCallbacks.onReceipt({ logs: [{ some: 'logs' }] });
      assert.isTrue(provider.onChainDataset.isObsolete());
    });
  });
});
