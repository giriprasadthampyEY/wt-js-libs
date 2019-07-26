import { assert } from 'chai';
import sinon from 'sinon';
import OnChainDataClient from '../../src/on-chain-data-client';
import Entrypoint from '../../src/on-chain-data-client/entrypoint';

describe('WTLibs.on-chain-data.OnChainDataClient', () => {
  describe('setup', () => {
    afterEach(() => {
      OnChainDataClient._reset();
    });

    it('should save options', () => {
      OnChainDataClient.setup({ opt1: 'value', gasMargin: 4 });
      assert.equal(OnChainDataClient.options.opt1, 'value');
      assert.equal(OnChainDataClient.options.gasMargin, 4);
      assert.isUndefined(OnChainDataClient.options.gasCoefficient);
      assert.isDefined(OnChainDataClient.entrypoints);
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

  describe('_reset', () => {
    it('should reset options and entrypoints', () => {
      OnChainDataClient.setup({ opt1: 'value', provider: 'http://localhost:8545' });
      OnChainDataClient.getEntrypoint('123');
      assert.isDefined(OnChainDataClient.entrypoints['123']);
      assert.isDefined(OnChainDataClient.options.opt1);
      OnChainDataClient._reset();
      assert.isUndefined(OnChainDataClient.entrypoints['123']);
      assert.isUndefined(OnChainDataClient.options.opt1);
    });
  });

  describe('getEntrypoint', () => {
    let createEntrypointSpy;

    beforeAll(() => {
      OnChainDataClient.setup({ provider: 'http://localhost:8545' });
      createEntrypointSpy = sinon.spy(Entrypoint, 'createInstance');
    });

    afterEach(() => {
      createEntrypointSpy.resetHistory();
    });

    it('should cache entrypoint instances', () => {
      OnChainDataClient.getEntrypoint('123');
      assert.equal(createEntrypointSpy.callCount, 1);
      assert.isDefined(OnChainDataClient.entrypoints['123']);
      OnChainDataClient.getEntrypoint('123');
      assert.equal(createEntrypointSpy.callCount, 1);
      const model = OnChainDataClient.getEntrypoint('456');
      assert.equal(createEntrypointSpy.callCount, 2);
      assert.instanceOf(model, Entrypoint);
    });
  });
});
