import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../utils/helpers';
import testedDataModel from '../utils/data-hotel-model-definition';
import OnChainOrganization from '../../src/on-chain-data-client/organization';
import { WtJsLibs } from '../../src/index';

describe('WTLibs.on-chain-data.Organization', () => {
  let contractsStub, utilsStub, urlStub, hashStub, ownerStub, associatedKeysStub, hasAssociatedKeyStub;
  let organization;

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
    };
    urlStub = helpers.stubContractMethodResult('some-remote-url');
    hashStub = helpers.stubContractMethodResult('hash');
    ownerStub = helpers.stubContractMethodResult('some-remote-owner');
    associatedKeysStub = helpers.stubContractMethodResult(['addr', 'addr2']);
    hasAssociatedKeyStub = helpers.stubContractMethodResult(true);
    contractsStub = {
      getOrganizationInstance: sinon.stub().resolves({
        methods: {
          getOrgJsonUri: urlStub,
          getOrgJsonHash: hashStub,
          owner: ownerStub,
          getAssociatedKeys: associatedKeysStub,
          hasAssociatedKey: hasAssociatedKeyStub,
        },
      }),
    };
    organization = OnChainOrganization.createInstance(utilsStub, contractsStub, 'some-address');
  });

  describe('initialize', () => {
    it('should setup orgJsonUri, orgJsonHash, owner and associatedKeys fields', () => {
      const provider = new OnChainOrganization(utilsStub, contractsStub);
      assert.isUndefined(provider.orgJsonUri);
      assert.isUndefined(provider.orgJsonHash);
      assert.isUndefined(provider.owner);
      assert.isUndefined(provider.associatedKeys);
      provider.initialize();
      assert.isDefined(provider.orgJsonUri);
      assert.isDefined(provider.orgJsonHash);
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

    it('should return orgJsonHash', async () => {
      assert.equal(await organization.orgJsonHash, 'hash');
      assert.equal(hashStub().call.callCount, 1);
    });

    it('should return owner', async () => {
      assert.equal(await organization.owner, 'some-remote-owner');
      assert.equal(ownerStub().call.callCount, 1);
    });

    it('should return associatedKeys', async () => {
      assert.equal((await organization.associatedKeys).length, 2);
      assert.equal(associatedKeysStub().call.callCount, 1);
    });

    it('should return orgJson with a setup StoragePointer', async () => {
      const index = await organization.orgJson;
      assert.equal(index.ref, 'some-remote-url');
    });
  });

  describe('hasAssociatedKey', () => {
    it('should call the smart contract', async () => {
      await organization.hasAssociatedKey('0x0');
      assert.equal(hasAssociatedKeyStub().call.callCount, 1);
    });
  });

  describe('toPlainObject', () => {
    it('should return a plain JS object', async () => {
      const libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
      const entrypoint = libs.getEntrypoint(testedDataModel.entrypointAddress);
      const directory = await entrypoint.getSegmentDirectory('hotels');
      organization = await directory.getOrganizationByIndex(1);
      const plainOrg = await organization.toPlainObject();
      assert.equal(plainOrg.owner, '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906');
      assert.isUndefined(plainOrg.toPlainObject);
      assert.isDefined(plainOrg.associatedKeys);
      assert.isDefined(plainOrg.address);
      assert.equal(plainOrg.orgJsonUri.ref, 'in-memory://hotel-one');
      assert.isDefined(plainOrg.orgJsonUri.contents);
      assert.isDefined(plainOrg.orgJsonHash);
      assert.equal(plainOrg.orgJsonUri.contents.name, 'organization-one');
    });
  });

  describe('getWindingTreeApi', () => {
    it('should return any wt api it finds wrapped into storagepointer', async () => {
      const libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
      const entrypoint = libs.getEntrypoint(testedDataModel.entrypointAddress);
      const directory = await entrypoint.getSegmentDirectory('hotels');
      organization = await directory.getOrganizationByIndex(1);
      const apiPointers = await organization.getWindingTreeApi();
      assert.isDefined(apiPointers.hotel);
      assert.equal(apiPointers.hotel.length, 1);
      assert.isDefined(apiPointers.airline);
      assert.equal(apiPointers.airline.length, 1);
      const hotelApi = await apiPointers.hotel[0].toPlainObject();
      assert.equal(hotelApi.contents.descriptionUri.contents.name, 'First hotel');
      const airlineApi = await apiPointers.airline[0].toPlainObject();
      assert.equal(airlineApi.contents.descriptionUri.contents.name, 'First airline');
    });
  });
});
