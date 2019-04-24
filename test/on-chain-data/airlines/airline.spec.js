import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../../utils/helpers';
import OnChainAirline from '../../../src/on-chain-data/airlines/airline';

describe('WTLibs.on-chain-data.airlines.Airline', () => {
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
      getAirlineInstance: sinon.stub().resolves({
        methods: {
          dataUri: urlStub,
          manager: managerStub,
          created: createdStub,
          editInfo: helpers.stubContractMethodResult('info-edited'),
        },
      }),
      decodeLogs: sinon.stub().returns([{
        attributes: [{ value: '0xnew-airline-address' }],
      }]),
    };
    indexContractStub = {
      options: {
        address: 'index-address',
      },
      methods: {
        callAirline: helpers.stubContractMethodResult('called-airline'),
        registerAirline: helpers.stubContractMethodResult('registered-airline'),
        deleteAirline: helpers.stubContractMethodResult('deleted-airline'),
        transferAirline: helpers.stubContractMethodResult('transfer-airline'),
      },
    };
  });

  describe('toPlainObject', () => {
    it('should return a plain JS object', async () => {
      const provider = OnChainAirline.createInstance(utilsStub, contractsStub, indexContractStub);
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
      const plainAirline = await provider.toPlainObject(); // fields?
      assert.equal(plainAirline.manager, validManager);
      assert.isUndefined(plainAirline.toPlainObject);
      assert.equal(plainAirline.dataUri.ref, validUri);
      assert.isDefined(plainAirline.dataUri.contents);
      assert.isDefined(plainAirline.dataUri.contents.descriptionUri);
    });
  });

  describe('createOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainAirline.createInstance(utilsStub, contractsStub, indexContractStub);
      const callSpy = sinon.spy(provider, '_createOnChainData');
      const result = await provider.createOnChainData({ from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.airline);
      assert.isUndefined(result.record);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._createOnChainData.restore();
    });
  });

  describe('updateOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainAirline.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      const callSpy = sinon.spy(provider, '_updateOnChainData');
      await provider.setLocalData({ dataUri: 'in-memory://new-link' });
      const result = await provider.updateOnChainData({ from: 'xx' });
      assert.equal(result.length, 1);
      assert.isDefined(result[0].transactionData);
      assert.isDefined(result[0].airline);
      assert.isUndefined(result[0].record);
      assert.isDefined(result[0].eventCallbacks);
      assert.isDefined(result[0].eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._updateOnChainData.restore();
    });
  });

  describe('transferOnChainOwnership', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainAirline.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      const callSpy = sinon.spy(provider, '_transferOnChainOwnership');
      const result = await provider.transferOnChainOwnership('new-manager', { from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.airline);
      assert.isUndefined(result.record);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._transferOnChainOwnership.restore();
    });
  });

  describe('removeOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainAirline.createInstance(utilsStub, contractsStub, indexContractStub, 'fake-address');
      const callSpy = sinon.spy(provider, '_removeOnChainData');
      const result = await provider.removeOnChainData({ from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.airline);
      assert.isUndefined(result.record);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
      assert.equal(callSpy.callCount, 1);
      provider._removeOnChainData.restore();
    });
  });
});
