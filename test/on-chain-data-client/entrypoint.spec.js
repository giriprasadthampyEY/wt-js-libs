import { assert } from 'chai';
import sinon from 'sinon';
import Directory from '../../src/on-chain-data-client/segment-directory';
import OrganizationFactory from '../../src/on-chain-data-client/organization-factory';

import OnChainDataClient from '../../src/on-chain-data-client';
import { OnChainDataRuntimeError } from '../../src/on-chain-data-client/errors';

xdescribe('WTLibs.on-chain-data.Entrypoint', () => {
  describe('setup', () => {
    //   let entrypoint;
    beforeEach(() => {
      // entrypoint =
    });

    it('should save options and dataModels', () => {
      OnChainDataClient.setup({ opt1: 'value', gasMargin: 4 });
      assert.equal(OnChainDataClient.options.opt1, 'value');
      assert.equal(OnChainDataClient.options.gasMargin, 4);
      assert.isUndefined(OnChainDataClient.options.gasCoefficient);
      assert.isDefined(OnChainDataClient._cache);
      assert.isDefined(OnChainDataClient._segmentAddresses);
    });

    it('should setup default gasCoefficient', () => {
      OnChainDataClient.setup({ opt1: 'value' });
      assert.isDefined(OnChainDataClient.options.gasCoefficient, 2);
    });

    it('should setup web3Utils', () => {
      OnChainDataClient.setup({ opt1: 'value', provider: 'http://localhost:8545' });
      assert.isDefined(OnChainDataClient.web3Utils);
      assert.equal(OnChainDataClient.web3Utils.gasModifiers.gasCoefficient, 2);
      assert.isUndefined(OnChainDataClient.web3Utils.gasModifiers.gasMargin);
      assert.equal(OnChainDataClient.web3Utils.provider, 'http://localhost:8545');
    });

    it('should setup web3Contracts', () => {
      OnChainDataClient.setup({ opt1: 'value', provider: 'http://localhost:8545' });
      assert.isDefined(OnChainDataClient.web3Contracts);
      assert.equal(OnChainDataClient.web3Contracts.provider, 'http://localhost:8545');
    });
  });

  describe('getDirectory', () => {
    let createDirectorySpy;

    beforeAll(() => {
      OnChainDataClient.setup({ provider: 'http://localhost:8545' });
      createDirectorySpy = sinon.spy(Directory, 'createInstance');
    });

    afterEach(() => {
      createDirectorySpy.resetHistory();
    });

    it('should cache datamodel instances', () => {
      OnChainDataClient.getDirectory('hotels', '123');
      assert.equal(createDirectorySpy.callCount, 1);
      assert.isDefined(OnChainDataClient.dataModels['hotels:123']);
      OnChainDataClient.getDirectory('hotels', '123');
      assert.equal(createDirectorySpy.callCount, 1);
      const model = OnChainDataClient.getDirectory('hotels', '456');
      assert.equal(createDirectorySpy.callCount, 2);
      assert.instanceOf(model, Directory);
    });

    it('should throw on unknown segment', () => {
      try {
        OnChainDataClient.getDirectory('random-segment', '123');
        assert(false);
      } catch (e) {
        assert.match(e.message, /unknown segment/i);
        assert.instanceOf(e, OnChainDataRuntimeError);
      }
    });
  });

  describe('getFactory', () => {
    let createFactorySpy;

    beforeAll(() => {
      OnChainDataClient.setup({ provider: 'http://localhost:8545' });
      createFactorySpy = sinon.spy(OrganizationFactory, 'createInstance');
    });

    afterEach(() => {
      createFactorySpy.resetHistory();
    });

    it('should cache datamodel instances', () => {
      OnChainDataClient.getFactory('123');
      assert.equal(createFactorySpy.callCount, 1);
      assert.isDefined(OnChainDataClient.factories['123']);
      OnChainDataClient.getFactory('123');
      assert.equal(createFactorySpy.callCount, 1);
      const model = OnChainDataClient.getFactory('456');
      assert.equal(createFactorySpy.callCount, 2);
      assert.instanceOf(model, OrganizationFactory);
    });
  });
});
