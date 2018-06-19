import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../../utils/helpers';
import OnChainHotel from '../../../src/data-model/on-chain-hotel';
import StoragePointer from '../../../src/storage-pointer';

describe('WTLibs.data-model.OnChainHotel', () => {
  let contractsStub, utilsStub, indexContractStub, walletStub, urlStub, managerStub;
  const validUri = 'schema://new-url';
  const validManager = 'manager';

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasCoefficient: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
      determineDeployedContractFutureAddress: sinon.stub().returns('future-address'),
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
    };
    indexContractStub = {
      options: {
        address: 'index-address',
      },
      methods: {
        callHotel: helpers.stubContractMethodResult('called-hotel'),
        registerHotel: helpers.stubContractMethodResult('registered-hotel'),
        deleteHotel: helpers.stubContractMethodResult('deleted-hotel'),
      },
    };
    walletStub = {
      signAndSendTransaction: sinon.spy((txOpts, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve('tx-hash');
      }),
    };
  });

  describe('initialize', () => {
    it('should setup dataUri and manager fields', async () => {
      const provider = new OnChainHotel(utilsStub, contractsStub, indexContractStub);
      assert.isUndefined(provider.dataUri);
      assert.isUndefined(provider.manager);
      await provider.initialize();
      assert.isDefined(provider.dataUri);
      assert.isDefined(provider.manager);
      assert.isFalse(provider.onChainDataset.isDeployed());
    });

    it('should mark eth backed dataset as deployed if address is passed', async () => {
      const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      assert.isTrue(provider.onChainDataset.isDeployed());
    });
  });

  describe('dataIndex', () => {
    it('should setup StoragePointer during the first access', async () => {
      const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
      const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.dataUri = 'json://something-new';
      assert.equal(storagePointerSpy.callCount, 0);
      await provider.dataIndex;
      assert.equal(storagePointerSpy.callCount, 1);
      assert.equal(storagePointerSpy.firstCall.args[0], 'json://something-new');
      storagePointerSpy.restore();
    });

    it('should reuse StoragePointer instance in successive calls', async () => {
      const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
      const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.dataUri = 'json://something-new';
      assert.equal(storagePointerSpy.callCount, 0);
      await provider.dataIndex;
      assert.equal(storagePointerSpy.callCount, 1);
      await provider.dataIndex;
      assert.equal(storagePointerSpy.callCount, 1);
      storagePointerSpy.restore();
    });
  });

  describe('setLocalData', () => {
    it('should set dataUri', async () => {
      const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      await provider.setLocalData({ dataUri: validUri, manager: validManager });
      assert.equal(await provider.dataUri, validUri);
      await provider.setLocalData({ dataUri: 'schema://another-url', manager: validManager });
      assert.equal(await provider.dataUri, 'schema://another-url');
    });

    it('should never null dataUri', async () => {
      try {
        const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.setLocalData({ dataUri: validUri, manager: validManager });
        assert.equal(await provider.dataUri, validUri);
        await provider.setLocalData({ dataUri: null, manager: validManager });
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.match(e.message, /cannot set dataUri when it is not provided/i);
      }
    });

    it('should never set invalid url', async () => {
      try {
        const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.setLocalData({ dataUri: validUri, manager: validManager });
        assert.equal(await provider.dataUri, validUri);
        await provider.setLocalData({ dataUri: 'invalid-url', manager: validManager });
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.match(e.message, /cannot set dataUri with invalid format/i);
      }
    });

    it('should set manager only when not yet deployed', async () => {
      try {
        const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.setLocalData({ manager: validManager, dataUri: validUri });
        assert.equal(await provider.manager, validManager);
        provider.address = '0xsomething';
        await provider.setLocalData({ manager: 'another-manager', dataUri: validUri });
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.match(e.message, /Cannot set manager when hotel is deployed/i);
      }
    });

    it('should never null manager', async () => {
      try {
        const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.setLocalData({ manager: validManager, dataUri: validUri });
        assert.equal(await provider.manager, validManager);
        await provider.setLocalData({ manager: null, dataUri: validUri });
      } catch (e) {
        assert.match(e.message, /cannot set manager to null/i);
      }
    });
  });

  describe('toPlainObject', () => {
    it('should return a plain JS object', async () => {
      const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      await provider.setLocalData({ dataUri: validUri, manager: validManager });
      const plainHotel = await provider.toPlainObject();
      assert.equal(plainHotel.dataUri, validUri);
      assert.equal(plainHotel.manager, validManager);
      assert.isUndefined(plainHotel.toPlainObject);
    });
  });

  describe('remote data definition', () => {
    it('should setup remoteGetter for dataUri', async () => {
      const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      assert.equal(urlStub().call.callCount, 0);
      await provider.dataUri;
      // The getter of url calls twice this._url
      assert.equal(urlStub().call.callCount, 2);
    });

    it('should setup remoteGetter for manager', async () => {
      const provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      assert.equal(managerStub().call.callCount, 0);
      await provider.manager;
      // The getter of manager calls twice this._manager
      assert.equal(managerStub().call.callCount, 2);
    });
  });

  describe('createOnChainData', () => {
    let provider;
    beforeEach(async () => {
      provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
    });
    it('should precompute address', async () => {
      const result = await provider.createOnChainData(walletStub, {});
      assert.deepEqual(result, ['tx-hash']);
      // index nonce + caller nonce
      assert.equal(utilsStub.determineCurrentAddressNonce.callCount, 2);
      assert.equal(utilsStub.determineDeployedContractFutureAddress.callCount, 1);
      assert.equal(walletStub.signAndSendTransaction.callCount, 1);
    });

    // TODO test cross hotel.manager vs. wallet.account

    it('should call registerHotel with applied gasCoefficient', async () => {
      const result = await provider.createOnChainData(walletStub, { from: 'xx' });
      assert.deepEqual(result, ['tx-hash']);
      assert.equal(utilsStub.applyGasCoefficient.callCount, 1);
      assert.equal(indexContractStub.methods.registerHotel().estimateGas.callCount, 1);
      assert.equal(indexContractStub.methods.registerHotel().encodeABI.callCount, 1);
      assert.equal(indexContractStub.methods.registerHotel().estimateGas.firstCall.args[0].from, 'xx');
      assert.equal(walletStub.signAndSendTransaction.callCount, 1);
      assert.equal(walletStub.signAndSendTransaction.firstCall.args[0].from, 'xx');
    });

    it('should mark dataset as deployed on success', async () => {
      assert.isFalse(provider.onChainDataset.isDeployed());
      await provider.createOnChainData(walletStub, { from: 'xx' });
      assert.isTrue(provider.onChainDataset.isDeployed());
    });

    it('should throw on transaction error', async () => {
      walletStub.signAndSendTransaction = sinon.stub().rejects(new Error('Cannot send signed transaction'));
      try {
        await provider.createOnChainData(walletStub, { from: 'xx' });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot create hotel/i);
      }
    });
  });

  describe('updateOnChainData', () => {
    let provider;
    beforeEach(async () => {
      provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      provider.dataUri = validUri;
    });

    it('should throw on an undeployed contract', async () => {
      try {
        let provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
        await provider.updateOnChainData(walletStub, {});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot get hotel/i);
      }
    });

    it('should throw when updating hotel without dataUri', async () => {
      try {
        provider.dataUri = null;
        await provider.updateOnChainData(walletStub, {});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot set dataUri when it is not provided/i);
      }
    });

    it('should call callHotel with applied gasCoefficient', async () => {
      const result = await provider.updateOnChainData(walletStub, { from: 'xx' });
      assert.deepEqual(result, ['tx-hash']);
      assert.equal(utilsStub.applyGasCoefficient.callCount, 1);
      assert.equal(indexContractStub.methods.callHotel().estimateGas.callCount, 1);
      assert.equal(indexContractStub.methods.callHotel().encodeABI.callCount, 1);
      assert.equal(indexContractStub.methods.callHotel().estimateGas.firstCall.args[0].from, 'xx');
      assert.equal(walletStub.signAndSendTransaction.callCount, 1);
      assert.equal(walletStub.signAndSendTransaction.firstCall.args[0].from, 'xx');
    });

    it('should throw on error', async () => {
      walletStub.signAndSendTransaction = sinon.stub().rejects(new Error('Cannot send signed transaction'));
      try {
        await provider.updateOnChainData(walletStub, { from: 'xx' });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
      }
    });
  });

  describe('removeOnChainData', () => {
    let provider;
    beforeEach(async () => {
      provider = await OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
    });

    it('should throw on an undeployed contract', async () => {
      try {
        provider.onChainDataset.__deployedFlag = false;
        await provider.removeOnChainData(walletStub, {});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot remove hotel/i);
      }
    });

    it('should call deleteHotel with applied gasCoefficient', async () => {
      const result = await provider.removeOnChainData(walletStub, { from: 'xx' });
      assert.deepEqual(result, ['tx-hash']);
      assert.equal(utilsStub.applyGasCoefficient.callCount, 1);
      assert.equal(indexContractStub.methods.deleteHotel().estimateGas.callCount, 1);
      assert.equal(indexContractStub.methods.deleteHotel().encodeABI.callCount, 1);
      assert.equal(indexContractStub.methods.deleteHotel().estimateGas.firstCall.args[0].from, 'xx');
      assert.equal(walletStub.signAndSendTransaction.callCount, 1);
      assert.equal(walletStub.signAndSendTransaction.firstCall.args[0].from, 'xx');
    });

    it('should mark dataset as obsolete on success', async () => {
      assert.isFalse(provider.onChainDataset.isObsolete());
      await provider.removeOnChainData(walletStub, { from: 'xx' });
      assert.isTrue(provider.onChainDataset.isObsolete());
    });

    it('should throw on error', async () => {
      walletStub.signAndSendTransaction = sinon.stub().rejects(new Error('Cannot send signed transaction'));
      try {
        await provider.removeOnChainData(walletStub, { from: 'xx' });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot remove hotel/i);
      }
    });
  });
});
