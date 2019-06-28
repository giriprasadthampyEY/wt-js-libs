import { assert } from 'chai';
import sinon from 'sinon';
import OrganizationFactory from '../../src/on-chain-data-client/organization-factory';
import helpers from '../utils/helpers';
import { WTLibsError } from '../../src/errors';
import { InputDataError } from '../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.OrganizationFactory', () => {
  let contractsStub, utilsStub, createStub;
  let factory;

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
      isZeroAddress: sinon.stub().callsFake((addr) => {
        return addr === '0x0000000000000000000000000000000000000000';
      }),
    };
    createStub = helpers.stubContractMethodResult('remote-add-result');
    contractsStub = {
      getOrganizationFactoryInstance: sinon.stub().resolves({
        methods: {
          create: createStub,
        },
      }),
    };
    factory = OrganizationFactory.createInstance('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', utilsStub, contractsStub);
  });

  describe('create', () => {
    it('should prepare transaction data', async () => {
      const tx = await factory.createOrganization({ owner: 'b', orgJsonUri: 'a' });
      assert.isDefined(tx.transactionData.nonce);
      assert.isDefined(tx.transactionData.data);
      assert.equal(tx.transactionData.from, 'b');
      assert.equal(tx.transactionData.to, factory.address);
    });

    it('should throw generic error when something does not work during tx data preparation', async () => {
      try {
        sinon.stub(factory, '_getDeployedFactory').resolves({
          methods: {
            create: {
              encodeABI: sinon.stub().rejects(new Error('something went wrong')),
            },
          },
        });
        await factory.createOrganization({ owner: 'b', orgJsonUri: 'aaa' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot create organization/i);
        assert.instanceOf(e, WTLibsError);
      } finally {
        factory._getDeployedFactory.restore();
      }
    });

    it('should throw when orgJsonUri is not provided', async () => {
      try {
        await factory.createOrganization({ owner: 'b' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot create organization/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should throw when owner is not provided', async () => {
      try {
        await factory.createOrganization({ orgJsonUri: 'b' });
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot create organization/i);
        assert.instanceOf(e, InputDataError);
      }
    });
  });

  describe('createAndAdd', () => {});
});
