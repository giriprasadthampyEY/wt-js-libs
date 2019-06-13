import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../../utils/helpers';
import OnChainHotel from '../../../src/on-chain-data-client/hotels/hotel';

describe('WTLibs.on-chain-data.hotels.Hotel', () => {
  let contractsStub, createdStub, utilsStub, directoryContractStub, urlStub, ownerStub;
  const validUri = 'schema://new-url';
  const validOwner = 'owner';

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
      orgJsonUri: helpers.stubContractMethodResult('http://hooray-data-uri'),
      created: helpers.stubContractMethodResult(1),
    };
    directoryContractStub = {
      options: {
        address: 'directory-address',
      },
      methods: {
        call: helpers.stubContractMethodResult('called-hotel'),
        add: helpers.stubContractMethodResult('registered-hotel'),
        remove: helpers.stubContractMethodResult('deleted-hotel'),
      },
    };
  });

  describe('toPlainObject', () => {
    it('should return a plain JS object', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, directoryContractStub);
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
      const plainHotel = await provider.toPlainObject(); // fields?
      assert.equal(plainHotel.owner, validOwner);
      assert.isUndefined(plainHotel.toPlainObject);
      assert.equal(plainHotel.orgJsonUri.ref, validUri);
      assert.isDefined(plainHotel.orgJsonUri.contents);
      assert.isDefined(plainHotel.orgJsonUri.contents.descriptionUri);
    });
  });

  describe('createOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, directoryContractStub);
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
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, directoryContractStub, 'fake-address');
      const callSpy = sinon.spy(provider, '_updateOnChainData');
      await provider.setLocalData({ orgJsonUri: 'in-memory://new-link' });
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

  describe('removeOnChainData', () => {
    it('should return transaction metadata', async () => {
      const provider = OnChainHotel.createInstance(utilsStub, contractsStub, directoryContractStub, 'fake-address');
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
