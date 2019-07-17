import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../utils/helpers';
import UpdateableOnChainOrganization from '../../src/on-chain-data-client/updateable-organization';
import StoragePointer from '../../src/on-chain-data-client/storage-pointer';
import { InputDataError, SmartContractInstantiationError } from '../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.UpdateableOrganization', () => {
  const validUri = 'schema://new-url';
  const validHash = '0xd1e15bcea4bbf5fa55e36bb5aa9ad5183a4acdc1b06a0f21f3dba8868dee2c99';
  let contractsStub, utilsStub, urlStub, hashStub, ownerStub, associatedKeysStub, hasAssociatedKeyStub,
    transferOwnershipStub, changeOrgJsonUriStub;
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
    transferOwnershipStub = helpers.stubContractMethodResult(null);
    changeOrgJsonUriStub = helpers.stubContractMethodResult(null);
    contractsStub = {
      getUpdateableOrganizationInstance: sinon.stub().resolves({
        methods: {
          getOrgJsonUri: urlStub,
          getOrgJsonHash: hashStub,
          owner: ownerStub,
          getAssociatedKeys: associatedKeysStub,
          hasAssociatedKey: hasAssociatedKeyStub,
          transferOwnership: transferOwnershipStub,
          changeOrgJsonUri: changeOrgJsonUriStub,
        },
      }),
    };
    organization = UpdateableOnChainOrganization.createInstance(utilsStub, contractsStub, 'some-address');
  });

  describe('initialize', () => {
    it('should setup orgJsonUri, orgJsonHash, owner and associatedKeys fields', () => {
      organization = new UpdateableOnChainOrganization(utilsStub, contractsStub);
      assert.isUndefined(organization.orgJsonUri);
      assert.isUndefined(organization.orgJsonHash);
      assert.isUndefined(organization.owner);
      assert.isUndefined(organization.associatedKeys);
      organization.initialize();
      assert.isDefined(organization.orgJsonUri);
      assert.isDefined(organization.orgJsonHash);
      assert.isDefined(organization.owner);
      assert.isDefined(organization.associatedKeys);
      assert.isFalse(organization.onChainDataset.isDeployed());
    });

    it('should mark eth backed dataset as deployed if address is passed', () => {
      organization = new UpdateableOnChainOrganization(utilsStub, contractsStub, 'fake-address');
      organization.initialize();
      assert.isTrue(organization.onChainDataset.isDeployed());
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

  describe('setLocalData', () => {
    it('should set orgJsonUri', async () => {
      await organization.setLocalData({ orgJsonUri: validUri });
      assert.equal(await organization.orgJsonUri, validUri);
      await organization.setLocalData({ orgJsonUri: 'schema://another-url' });
      assert.equal(await organization.orgJsonUri, 'schema://another-url');
    });

    it('should never null orgJsonUri', async () => {
      await organization.setLocalData({ orgJsonUri: validUri });
      assert.equal(await organization.orgJsonUri, validUri);
      await organization.setLocalData({ orgJsonUri: null });
      assert.equal(await organization.orgJsonUri, validUri);
    });

    it('should never set invalid orgJsonUri', async () => {
      try {
        await organization.setLocalData({ orgJsonUri: validUri });
        assert.equal(await organization.orgJsonUri, validUri);
        await organization.setLocalData({ orgJsonUri: 'invalid-url' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot update organization/i);
        assert.match(e.message, /cannot set orgJsonUri with invalid format/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should allow dash in orgJsonUri', async () => {
      await organization.setLocalData({ orgJsonUri: validUri });
      assert.equal(await organization.orgJsonUri, validUri);
      await organization.setLocalData({ orgJsonUri: 'bzz-raw://valid-url' });
      assert.equal(await organization.orgJsonUri, 'bzz-raw://valid-url');
    });

    it('should set orgJsonHash', async () => {
      await organization.setLocalData({ orgJsonHash: validHash });
      assert.equal(await organization.orgJsonHash, validHash);
      await organization.setLocalData({ orgJsonHash: '0xd1e15bcea4bbf5fa55e36bb5aa9ad5183a4acdc1b06a0f21f3dba8868dee2c98' });
      assert.equal(await organization.orgJsonHash, '0xd1e15bcea4bbf5fa55e36bb5aa9ad5183a4acdc1b06a0f21f3dba8868dee2c98');
    });

    it('should never null orgJsonHash', async () => {
      await organization.setLocalData({ orgJsonHash: validHash });
      assert.equal(await organization.orgJsonHash, validHash);
      await organization.setLocalData({ orgJsonHash: null });
      assert.equal(await organization.orgJsonHash, validHash);
    });

    it('should never set invalid orgJsonHash', async () => {
      try {
        await organization.setLocalData({ orgJsonHash: validHash });
        assert.equal(await organization.orgJsonHash, validHash);
        await organization.setLocalData({ orgJsonHash: 'invalid-hash' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot update organization/i);
        assert.match(e.message, /cannot set orgJsonHash with invalid format/i);
        assert.instanceOf(e, InputDataError);
      }
    });
  });

  describe('setters', () => {
    it('should never null orgJsonUri', async () => {
      try {
        organization.orgJsonUri = null;
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot set orgJsonUri when it is not provided/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should never set orgJsonUri in a bad format', async () => {
      try {
        organization.orgJsonUri = 'some-weird-uri';
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot set orgJsonUri with invalid format/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should reset orgJson if orgJsonUri changes', async () => {
      organization.orgJsonUri = 'in-memory://something-else';
      assert.isNull(organization._orgJson);
    });

    it('should not reset orgJson if orgJsonUri remains the same', async () => {
      await organization.setLocalData({ orgJsonUri: validUri });
      organization.orgJsonUri = await organization.orgJsonUri;
      assert.isNull(organization._orgJson);
    });

    it('should never null orgJsonHash', async () => {
      try {
        organization.orgJsonHash = null;
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot set orgJsonHash when it is not provided/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should never set orgJsonHash in a bad format', async () => {
      try {
        organization.orgJsonHash = 'some-weird-hash that is not in prefixed hex';
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot set orgJsonHash with invalid format/i);
        assert.instanceOf(e, InputDataError);
      }
    });
  });

  describe('storage pointer', () => {
    it('should drop current StoragePointer instance when orgJsonUri changes via setLocalData', async () => {
      const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
      organization.orgJsonUri = 'in-memory://something-new';
      await organization.orgJson;
      assert.equal((await organization.orgJson).ref, 'in-memory://something-new');
      assert.equal(storagePointerSpy.callCount, 1);
      await organization.orgJson;
      assert.equal(storagePointerSpy.callCount, 1);
      await organization.setLocalData({
        orgJsonUri: 'in-memory://something-completely-different',
      });
      await organization.orgJson;
      assert.equal(storagePointerSpy.callCount, 2);
      assert.equal((await organization.orgJson).ref, 'in-memory://something-completely-different');
      storagePointerSpy.restore();
    });

    it('should drop current StoragePointer instance when orgJsonUri changes via direct access', async () => {
      const storagePointerSpy = sinon.spy(StoragePointer, 'createInstance');
      organization.orgJsonUri = 'in-memory://something-new';
      await organization.orgJson;
      assert.equal((await organization.orgJson).ref, 'in-memory://something-new');
      assert.equal(storagePointerSpy.callCount, 1);
      await organization.orgJson;
      assert.equal(storagePointerSpy.callCount, 1);
      organization.orgJsonUri = 'in-memory://something-completely-different';
      await organization.orgJson;
      assert.equal(storagePointerSpy.callCount, 2);
      assert.equal((await organization.orgJson).ref, 'in-memory://something-completely-different');
      storagePointerSpy.restore();
    });
  });

  describe('hasAssociatedKey', () => {
    it('should call the smart contract', async () => {
      await organization.hasAssociatedKey('0x0');
      assert.equal(hasAssociatedKeyStub().call.callCount, 1);
    });
  });

  describe('updateOnChainData', () => {
    beforeEach(async () => {
      organization = UpdateableOnChainOrganization.createInstance(utilsStub, contractsStub, 'fake-address');
    });

    it('should throw on an undeployed contract', async () => {
      try {
        organization = UpdateableOnChainOrganization.createInstance(utilsStub, contractsStub);
        await organization.updateOnChainData({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /instance without address/i);
        assert.instanceOf(e, SmartContractInstantiationError);
      }
    });

    it('should throw when updating hotel without orgJsonUri', async () => {
      try {
        organization.orgJsonUri = null;
        await organization.updateOnChainData({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot set orgJsonUri when it is not provided/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should throw when updating hotel without orgJsonHash', async () => {
      try {
        organization.orgJsonHash = null;
        await organization.updateOnChainData({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot set orgJsonHash when it is not provided/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should return transactions metadata', async () => {
      await organization.setLocalData({ orgJsonUri: validUri });
      const result = await organization.updateOnChainData({ from: 'xx' });
      assert.equal(result.length, 1);
      assert.isDefined(result[0].transactionData);
      assert.isDefined(result[0].organization);
      assert.isDefined(result[0].eventCallbacks);
      assert.isDefined(result[0].eventCallbacks.onReceipt);
    });

    it('should apply gasCoefficient', async () => {
      await organization.setLocalData({ orgJsonUri: validUri });
      await organization.updateOnChainData({ from: 'xx' });
      assert.equal(utilsStub.applyGasModifier.callCount, 1);
      assert.equal(changeOrgJsonUriStub().estimateGas.callCount, 1);
      assert.equal(changeOrgJsonUriStub().encodeABI.callCount, 1);
    });
  });

  describe('transferOnChainOwnership', () => {
    beforeEach(async () => {
      organization = UpdateableOnChainOrganization.createInstance(utilsStub, contractsStub, 'fake-address');
    });

    it('should throw on an undeployed contract', async () => {
      try {
        organization.onChainDataset._deployedFlag = false;
        await organization.transferOnChainOwnership({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot transfer organization/i);
        assert.instanceOf(e, SmartContractInstantiationError);
      }
    });

    it('should return transaction metadata', async () => {
      const result = await organization.transferOnChainOwnership('new-owner', { from: 'xx' });
      assert.isDefined(result.transactionData);
      assert.isDefined(result.organization);
      assert.isDefined(result.eventCallbacks);
      assert.isDefined(result.eventCallbacks.onReceipt);
    });

    it('should apply gasCoefficient', async () => {
      await organization.transferOnChainOwnership('new-owner', { from: 'xx' });
      assert.equal(utilsStub.applyGasModifier.callCount, 1);
      assert.equal(transferOwnershipStub().estimateGas.callCount, 1);
      assert.equal(transferOwnershipStub().encodeABI.callCount, 1);
    });

    it('should set owner', async () => {
      assert.equal(await organization.owner, 'some-remote-owner');
      const result = await organization.transferOnChainOwnership('new-owner', { from: 'xx' });
      result.eventCallbacks.onReceipt({ logs: [{ some: 'logs' }] });
      assert.equal(await organization.owner, 'new-owner');
    });
  });
});
