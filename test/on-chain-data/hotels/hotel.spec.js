import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../../utils/helpers';
import OnChainHotel from '../../../src/on-chain-data/hotels/hotel';

describe('WTLibs.on-chain-data.hotels.Hotel', () => {
  let contractsStub, createdStub, utilsStub, indexContractStub, urlStub, managerStub;
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
        callHotel: helpers.stubContractMethodResult('called-hotel'),
        registerHotel: helpers.stubContractMethodResult('registered-hotel'),
        deleteHotel: helpers.stubContractMethodResult('deleted-hotel'),
        transferHotel: helpers.stubContractMethodResult('transfer-hotel'),
      },
    };
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
      const plainHotel = await provider.toPlainObject(); // fields?
      assert.equal(plainHotel.manager, validManager);
      assert.isUndefined(plainHotel.toPlainObject);
      assert.equal(plainHotel.dataUri.ref, validUri);
      assert.isDefined(plainHotel.dataUri.contents);
      assert.isDefined(plainHotel.dataUri.contents.descriptionUri);
    });
  });

  describe('createOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub);
      const callSpy = sinon.spy(provider, '_createOnChainData');
      const result = await provider.createOnChainData({ from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.hotel);
      assert.isUndefined(result.record);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._createOnChainData.restore();
    });
  });

  describe('updateOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      const callSpy = sinon.spy(provider, '_updateOnChainData');
      await provider.setLocalData({ dataUri: 'in-memory://new-link' });
      const result = await provider.updateOnChainData({ from: 'xx' });
      assert.equal(result.length, 1);
      assert.isDefined(result[0].transactionData);
      assert.isDefined(result[0].hotel);
      assert.isUndefined(result[0].record);
      assert.isDefined(result[0].eventCallbacks);
      assert.isDefined(result[0].eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._updateOnChainData.restore();
    });
  });

  describe('transferOnChainOwnership', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      const callSpy = sinon.spy(provider, '_transferOnChainOwnership');
      const result = await provider.transferOnChainOwnership('new-manager', { from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.hotel);
      assert.isUndefined(result.record);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._transferOnChainOwnership.restore();
    });
  });

  describe('removeOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      const callSpy = sinon.spy(provider, '_removeOnChainData');
      const result = await provider.removeOnChainData({ from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.hotel);
      assert.isUndefined(result.record);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._removeOnChainData.restore();
    });
  });
});
