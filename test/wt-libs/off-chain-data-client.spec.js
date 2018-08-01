import { assert } from 'chai';
import OffChainDataClient from '../../src/off-chain-data-client';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';
import { OffChainDataRuntimeError, OffChainDataConfigurationError } from '../../src/errors';

describe('WTLibs.OffChainDataClient', () => {
  beforeEach(() => {
    OffChainDataClient.setup({
      adapters: {
        'in-memory': {
          create: () => {
            return new InMemoryAdapter();
          },
        },
      },
    });
  });

  afterEach(() => {
    OffChainDataClient._reset();
  });

  it('should return proper adapter', () => {
    const adapter = OffChainDataClient.getAdapter('in-memory');
    assert.isDefined(adapter);
    assert.isDefined(adapter._getHash);
  });

  it('should be case insensitive', () => {
    const adapter = OffChainDataClient.getAdapter('IN-MEMOrY');
    assert.isDefined(adapter);
    assert.isDefined(adapter._getHash);
  });

  it('should throw when adapter schemas are ambiguous', () => {
    assert.throws(() =>
      OffChainDataClient.setup({
        adapters: {
          'in-memory': { create: () => { return new InMemoryAdapter(); } },
          'IN-MEMOrY': { create: () => { return new InMemoryAdapter(); } },
        },
      }), OffChainDataConfigurationError, /Adapter declared twice/);
  });

  it('should throw when no adapter is found for given schema', () => {
    try {
      OffChainDataClient.getAdapter('non-existent');
      throw new Error('should have never been called');
    } catch (e) {
      assert.match(e.message, /unsupported data storage type/i);
      assert.instanceOf(e, OffChainDataRuntimeError);
    }
  });
});
