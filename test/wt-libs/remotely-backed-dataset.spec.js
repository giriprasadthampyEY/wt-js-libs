import { assert } from 'chai';
import sinon from 'sinon';
import RemotelyBackedDataset from '../../src/remotely-backed-dataset';

import { RemoteDataAccessError, RemoteDataReadError } from '../../src/errors';

describe('WTLibs.RemotelyBackedDataset', () => {
  let bbbInstance, remoteGetterStub, remoteSetterStub,
    remoteGetterStub2, remoteSetterStub2, commonRemoteSetterStub,
    onReceiptStub;
  beforeEach(() => {
    bbbInstance = new RemotelyBackedDataset();
    onReceiptStub = sinon.stub();
    remoteGetterStub = sinon.stub().resolves('field name');
    remoteSetterStub = sinon.stub().resolves({ 'setter1': 'result' });
    remoteGetterStub2 = sinon.stub().resolves('field name');
    remoteSetterStub2 = sinon.stub().resolves({ 'setter2': 'result', eventCallbacks: { 'onReceipt': onReceiptStub } });
    remoteSetterStub2.toString = () => 'stub2'; // to fix possible hashing conflicts
    commonRemoteSetterStub = sinon.stub().resolves({ 'commonsetter': 'object' });
    commonRemoteSetterStub.toString = () => 'commonStub'; // to fix possible hashing conflicts
    bbbInstance.bindProperties({
      fields: {
        randomField: {
          remoteGetter: remoteGetterStub,
          remoteSetter: remoteSetterStub,
        },
        randomField2: {
          remoteGetter: remoteGetterStub2,
          remoteSetter: remoteSetterStub2,
        },
        commonField: {
          remoteSetter: commonRemoteSetterStub,
        },
        commonField2: {
          remoteSetter: commonRemoteSetterStub,
        },
      },
    }, bbbInstance);
  });

  describe('communication with remote repo', () => {
    it('should fetch data remotely when accessed for the first time from a deployed storage', async () => {
      bbbInstance.markDeployed();
      assert.equal(remoteGetterStub.callCount, 0);
      await bbbInstance.randomField;
      assert.equal(remoteGetterStub.callCount, 1);
      await bbbInstance.randomField;
      assert.equal(remoteGetterStub.callCount, 1);
    });

    it('should not propagate changed value to remote storage immediately', () => {
      bbbInstance.markDeployed();
      bbbInstance.randomField = 'new value';
      assert.equal(remoteSetterStub.callCount, 0);
    });

    it('should propagate only changed value to a remote storage', async () => {
      bbbInstance.markDeployed();
      bbbInstance.randomField = 'new value';
      const txdata = await bbbInstance.updateRemoteData({});
      assert.equal(txdata.length, 1);
      assert.equal(remoteSetterStub.callCount, 1);
      assert.equal(remoteSetterStub2.callCount, 0);
      // force state change manually
      txdata[0].eventCallbacks.onReceipt();

      bbbInstance.randomField = 'new value';
      const txdata2 = await bbbInstance.updateRemoteData({});
      assert.equal(txdata2.length, 0);
      assert.equal(remoteSetterStub.callCount, 1);
      assert.equal(remoteSetterStub2.callCount, 0);
    });

    it('should do multiple calls if necessary', async () => {
      bbbInstance.markDeployed();
      bbbInstance.randomField = 'new value';
      bbbInstance.randomField2 = 'new another value';
      const txdata = await bbbInstance.updateRemoteData({});
      assert.equal(txdata.length, 2);
      assert.equal(remoteSetterStub.callCount, 1);
      assert.equal(remoteSetterStub2.callCount, 1);
    });

    it('should call the same remote setter only once if data is synced', async () => {
      bbbInstance.markDeployed();
      bbbInstance.commonField = 'new value';
      bbbInstance.commonField2 = 'new value2';
      const txdata = await bbbInstance.updateRemoteData({});
      assert.equal(txdata.length, 1);
      assert.equal(remoteSetterStub.callCount, 0);
      assert.equal(remoteSetterStub2.callCount, 0);
      assert.equal(commonRemoteSetterStub.callCount, 1);
      assert.isDefined(txdata[0].eventCallbacks);
      assert.isDefined(txdata[0].eventCallbacks.onReceipt);
    });

    it('should append onReceipt eventCallback if remoteSetter already has one', async () => {
      bbbInstance.markDeployed();
      bbbInstance.randomField2 = 'new value2';
      const txdata = await bbbInstance.updateRemoteData({});
      txdata[0].eventCallbacks.onReceipt();
      assert.equal(onReceiptStub.callCount, 1);
      assert.equal(remoteSetterStub2.callCount, 1);
    });

    it('should throw when something goes wrong during the remote sync', async () => {
      const instance = new RemotelyBackedDataset();
      const getterStub = sinon.stub().rejects(new Error('something went south'));
      instance.bindProperties({
        fields: {
          randomField: {
            remoteGetter: getterStub,
          },
        },
      }, instance);
      instance.markDeployed();
      try {
        await instance._syncRemoteData({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot sync remote data/i);
        assert.match(e.message, /something went south/i);
        assert.instanceOf(e, RemoteDataReadError);
      }
    });
  });

  describe('deployed state', () => {
    it('should not allow remote getting if object is not marked as deployed', async () => {
      try {
        await bbbInstance._fetchRemoteData();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot fetch undeployed/i);
        assert.instanceOf(e, RemoteDataAccessError);
      }
    });
  });
  
  describe('obsolete state', () => {
    it('should not allow getting when object is in obsolete state', async () => {
      try {
        bbbInstance.markObsolete();
        assert.equal(await bbbInstance.randomField, 'field name');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /object was destroyed/i);
        assert.instanceOf(e, RemoteDataAccessError);
      }
    });

    it('should not allow setting when object is in obsolete state', () => {
      bbbInstance.markObsolete();
      try {
        bbbInstance.randomField = 'something';
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /object was destroyed/i);
        assert.instanceOf(e, RemoteDataAccessError);
      }
    });
  });
});
