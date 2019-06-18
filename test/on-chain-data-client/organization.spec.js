import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../utils/helpers';
import OnChainOrganization from '../../src/on-chain-data-client/organization';

describe.only('WTLibs.on-chain-data.Organization', () => {
  let contractsStub, utilsStub, urlStub, ownerStub, associatedKeysStub, hasAssociatedKeyStub;
  let organization;

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
    };
    urlStub = helpers.stubContractMethodResult('some-remote-url');
    ownerStub = helpers.stubContractMethodResult('some-remote-owner');
    associatedKeysStub = helpers.stubContractMethodResult(['addr', 'addr2']);
    hasAssociatedKeyStub = helpers.stubContractMethodResult(true);
    contractsStub = {
      getOrganizationInstance: sinon.stub().resolves({
        methods: {
          getOrgJsonUri: urlStub,
          owner: ownerStub,
          getAssociatedKeys: associatedKeysStub,
          hasAssociatedKey: hasAssociatedKeyStub,
        },
      }),
    };
    organization = OnChainOrganization.createInstance(utilsStub, contractsStub, 'some-address');
  });

  describe('initialize', () => {
    it('should setup orgJsonUri, owner and associatedKeys fields', () => {
      const provider = new OnChainOrganization(utilsStub, contractsStub);
      assert.isUndefined(provider.orgJsonUri);
      assert.isUndefined(provider.owner);
      assert.isUndefined(provider.associatedKeys);
      provider.initialize();
      assert.isDefined(provider.orgJsonUri);
      assert.isDefined(provider.owner);
      assert.isDefined(provider.associatedKeys);
      assert.isFalse(provider.onChainDataset.isDeployed());
    });

    it('should mark eth backed dataset as deployed if address is passed', () => {
      const provider = new OnChainOrganization(utilsStub, contractsStub, 'fake-address');
      provider.initialize();
      assert.isTrue(provider.onChainDataset.isDeployed());
    });
  });

  describe('data getters', () => {
    it('should return orgJsonUri', async () => {
      assert.equal(await organization.orgJsonUri, 'some-remote-url');
      assert.equal(urlStub().call.callCount, 1);
    });

    it('should return owner', async () => {
      assert.equal(await organization.owner, 'some-remote-owner');
      assert.equal(ownerStub().call.callCount, 1);
    });

    it('should return associatedKeys', async () => {
      assert.equal((await organization.associatedKeys).length, 2);
      assert.equal(associatedKeysStub().call.callCount, 1);
    });

    it('should return dataIndex with a setup StoragePointer', async () => {
      const index = await organization.dataIndex;
      assert.equal(index.ref, 'some-remote-url');
    });
  });

  describe('hasAssociatedKey', () => {
    it('should call the smart contract', async () => {
      await organization.hasAssociatedKey('0x0');
      assert.equal(hasAssociatedKeyStub().call.callCount, 1);
    });
  });

  xdescribe('toPlainObject', () => {
    // TODO
    it('should return a plain JS object', async () => {
      /* provider = new MockedProvider(utilsStub, contractsStub, directoryContractStub);
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
        */
    });
  });
});
