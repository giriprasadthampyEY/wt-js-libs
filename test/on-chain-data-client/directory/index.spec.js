import { assert } from 'chai';
import sinon from 'sinon';
import SegmentDirectory from '../../../src/on-chain-data-client/directory';
import OnChainOrganization from '../../../src/on-chain-data-client/directory/organization';
import helpers from '../../utils/helpers';
import { WTLibsError } from '../../../src/errors';
import { OrganizationNotFoundError, OrganizationNotInstantiableError, InputDataError } from '../../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.Directory', () => {
  let contractsStub, utilsStub, ownerStub, addStub, removeStub;
  let directory;

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
      isZeroAddress: sinon.stub().callsFake((addr) => {
        return addr === '0x0000000000000000000000000000000000000000';
      }),
    };
    ownerStub = helpers.stubContractMethodResult('some-remote-owner');
    addStub = helpers.stubContractMethodResult('remote-add-result');
    removeStub = helpers.stubContractMethodResult('remote-remove-result');
    contractsStub = {
      getSegmentDirectoryInstance: sinon.stub().resolves({
        methods: {
          owner: ownerStub,
          add: addStub,
          remove: removeStub,
          getLifToken: helpers.stubContractMethodResult('0xAd84405aeF5d241E1BB264f0a58E238e221d70dE'),
          getSegment: helpers.stubContractMethodResult('organizations'),
          organizationsIndex: helpers.stubContractMethodResult('1'),
        },
      }),
    };
    directory = SegmentDirectory.createInstance('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', utilsStub, contractsStub);
  });

  describe('add', () => {
    it('should prepare transaction data', async () => {
      const tx = await directory.add({ owner: 'b', address: 'a' });
      assert.isDefined(tx.directory);
      assert.isDefined(tx.directory.address, directory.address);
      assert.isDefined(tx.transactionData.nonce);
      assert.isDefined(tx.transactionData.data);
      assert.equal(tx.transactionData.from, 'b');
      assert.equal(tx.transactionData.to, directory.address);
    });

    it('should throw generic error when something does not work during tx data preparation', async () => {
      try {
        sinon.stub(directory, '_getDeployedDirectory').resolves({
          methods: {
            add: {
              encodeABI: sinon.stub().rejects(new Error('something went wrong')),
            },
          },
        });
        await directory.add({ owner: 'b', address: 'aaa' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot add organization/i);
        assert.instanceOf(e, WTLibsError);
      } finally {
        directory._getDeployedDirectory.restore();
      }
    });

    it('should throw when address is not provided', async () => {
      try {
        await directory.add({ owner: 'b' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot add organization/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should throw when owner is not provided', async () => {
      try {
        await directory.add({ address: 'b' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot add organization/i);
        assert.instanceOf(e, InputDataError);
      }
    });
  });

  describe('remove', () => {
    it('should prepare transaction data', async () => {
      const tx = await directory.remove({ owner: 'b', address: 'a' });
      assert.isDefined(tx.directory);
      assert.isDefined(tx.directory.address, directory.address);
      assert.isDefined(tx.transactionData.nonce);
      assert.isDefined(tx.transactionData.data);
      assert.equal(tx.transactionData.from, 'b');
      assert.equal(tx.transactionData.to, directory.address);
    });

    it('should throw generic error when something does not work during tx data preparation', async () => {
      try {
        sinon.stub(directory, '_getDeployedDirectory').resolves({
          methods: {
            remove: {
              encodeABI: sinon.stub().rejects(new Error('something went worng')),
            },
          },
        });
        await directory.remove({
          owner: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
          address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
        });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot remove organization/i);
        assert.instanceOf(e, WTLibsError);
      } finally {
        directory._getDeployedDirectory.restore();
      }
    });

    it('should throw error when trying to remove a organization without owner', async () => {
      try {
        await directory.remove({
          address: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
        });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot remove organization/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw error when trying to remove a organization without address', async () => {
      try {
        await directory.remove({
          owner: '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769',
        });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot remove organization/i);
        assert.instanceOf(e, WTLibsError);
      }
    });
  });

  describe('getSegment', () => {
    it('should return segment', async () => {
      const segment = await directory.getSegment();
      assert.equal(segment, 'organizations');
    });
  });

  describe('getLifTokenAddress', () => {
    it('should return LifToken address', async () => {
      const tokenAddress = await directory.getLifTokenAddress();
      assert.equal(tokenAddress, '0xAd84405aeF5d241E1BB264f0a58E238e221d70dE');
    });
  });

  describe('getOrganization', () => {
    it('should throw if address is malformed', async () => {
      try {
        // we can fake it by emulating bad argument type
        sinon.stub(directory, 'getOrganizationIndex').rejects();
        await directory.getOrganization('random-address');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find organization/i);
        assert.instanceOf(e, WTLibsError);
      }
    });

    it('should throw if no record exists on that address', async () => {
      try {
        sinon.stub(directory, 'getOrganizationIndex').resolves(0);
        await directory.getOrganization('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find organization/i);
        assert.instanceOf(e, OrganizationNotFoundError);
      }
    });

    it('should throw if organization contract cannot be instantiated', async () => {
      try {
        sinon.stub(OnChainOrganization, 'createInstance').throws(new Error());
        await directory.getOrganization('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot instantiate organization/i);
        assert.instanceOf(e, OrganizationNotInstantiableError);
      } finally {
        OnChainOrganization.createInstance.restore();
      }
    });
  });

  describe('getOrganizations', () => {
    it('should not panic when one of many records is missing on-chain', async () => {
      sinon.stub(directory, '_getDeployedDirectory').resolves({
        methods: {
          getOrganizations: helpers.stubContractMethodResult([
            '0x0000000000000000000000000000000000000000', // This is an empty address
            '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769',
            '0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', // This is not an address of a organization
          ]),
        },
      });
      directory.getOrganization = sinon.stub()
        .callsFake((addr) => {
          return addr === '0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA' ? Promise.reject(new Error()) : Promise.resolve({
            addr,
          });
        });
      const records = await directory.getOrganizations();
      // Attempting to get two organizations for two valid addresses
      assert.equal(directory.getOrganization.callCount, 2);
      // But we know there's only one actual organization
      assert.equal(records.length, 1);
      directory._getDeployedDirectory.restore();
    });
  });
});
