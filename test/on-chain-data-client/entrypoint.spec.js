import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../utils/helpers';
import Entrypoint from '../../src/on-chain-data-client/entrypoint';
import SegmentDirectory from '../../src/on-chain-data-client/segment-directory';
import OrganizationFactory from '../../src/on-chain-data-client/organization-factory';
import { OnChainDataRuntimeError } from '../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.Entrypoint', () => {
  let contractsStub, utilsStub, orgFactoryStub;
  let entrypoint;

  beforeEach(() => {
    utilsStub = {
      getCurrentWeb3Provider: sinon.stub().returns('current-provider'),
      applyGasModifier: sinon.stub().returns(12),
      determineCurrentAddressNonce: sinon.stub().resolves(3),
      isZeroAddress: sinon.stub().callsFake((addr) => {
        return addr === '0x0000000000000000000000000000000000000000';
      }),
    };
    orgFactoryStub = helpers.stubContractMethodResult('0x5678');
    contractsStub = {
      getEntrypointInstance: sinon.stub().resolves({
        methods: {
          getSegment: helpers.stubContractMethodResult('0x1234'),
          getOrganizationFactory: orgFactoryStub,
        },
      }),
    };
    entrypoint = Entrypoint.createInstance('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA', utilsStub, contractsStub);
  });

  describe('getSegmentAddress', () => {
    it('should return a segment address', async () => {
      const addr = await entrypoint.getSegmentAddress('hotels');
      assert.equal(addr, '0x1234');
    });
  });

  describe('getSegmentDirectory', () => {
    it('should return SegmentDirectory instance', async () => {
      const segmentAddressSpy = sinon.spy(entrypoint, 'getSegmentAddress');
      const directory = await entrypoint.getSegmentDirectory('hotels');
      assert.equal(segmentAddressSpy.callCount, 1);
      assert.instanceOf(directory, SegmentDirectory);
      assert.equal(directory.address, '0x1234');
      segmentAddressSpy.restore();
    });

    it('should cache SegmentDirectory instance', async () => {
      const segmentAddressSpy = sinon.spy(entrypoint, 'getSegmentAddress');
      const directory = await entrypoint.getSegmentDirectory('hotels');
      assert.equal(segmentAddressSpy.callCount, 1);
      assert.instanceOf(directory, SegmentDirectory);
      assert.equal(directory.address, '0x1234');
      await entrypoint.getSegmentDirectory('hotels');
      await entrypoint.getSegmentDirectory('hotels');
      assert.equal(segmentAddressSpy.callCount, 1);
      segmentAddressSpy.restore();
    });

    it('should throw if user asks for a non-existent directory', async () => {
      const segmentAddressStub = sinon.stub(entrypoint, 'getSegmentAddress').resolves('0x0000000000000000000000000000000000000000');
      try {
        await entrypoint.getSegmentDirectory('airlines');
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find segment/i);
        assert.instanceOf(e, OnChainDataRuntimeError);
      } finally {
        segmentAddressStub.restore();
      }
    });
  });

  describe('getOrganizationFactory', () => {
    it('should return OrganizationFactory instance', async () => {
      const factory = await entrypoint.getOrganizationFactory();
      assert.equal(orgFactoryStub().call.callCount, 1);
      assert.instanceOf(factory, OrganizationFactory);
      assert.equal(factory.address, '0x5678');
    });

    it('should cache OrganizationFactory instance', async () => {
      const factory = await entrypoint.getOrganizationFactory();
      assert.equal(orgFactoryStub().call.callCount, 1);
      await entrypoint.getOrganizationFactory();
      await entrypoint.getOrganizationFactory();
      assert.equal(orgFactoryStub().call.callCount, 1);
      assert.instanceOf(factory, OrganizationFactory);
      assert.equal(factory.address, '0x5678');
    });

    it('should throw if user asks for a non-existent directory', async () => {
      orgFactoryStub().call.resolves('0x0000000000000000000000000000000000000000');
      try {
        await entrypoint.getOrganizationFactory();
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot find organization factory/i);
        assert.instanceOf(e, OnChainDataRuntimeError);
      }
    });
  });
});
