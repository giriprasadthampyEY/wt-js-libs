import { assert } from 'chai';
import OffChainDataClient from '../../src/off-chain-data-client';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';

describe('WTLibs.OffChainDataClient', () => {
  beforeEach(() => {
    OffChainDataClient.setup({
      adapters: {
        json: {
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

  it('should return proper adapter', async () => {
    const adapter = await OffChainDataClient.getAdapter('json');
    assert.isDefined(adapter);
    assert.isDefined(adapter._getHash);
  });

  it('should be case insensitive', async () => {
    const adapter = await OffChainDataClient.getAdapter('JSON');
    assert.isDefined(adapter);
    assert.isDefined(adapter._getHash);
  });

  it('should throw when adapter schemas are ambiguous', async () => {
    assert.throws(() =>
      OffChainDataClient.setup({
        adapters: {
          json: { create: () => { return new InMemoryAdapter(); } },
          JSON: { create: () => { return new InMemoryAdapter(); } },
        },
      }), /Adapter declared twice/);
  });

  it('should throw when no adapter is found for given schema', async () => {
    try {
      await OffChainDataClient.getAdapter('non-existent');
      throw new Error('should have never been called');
    } catch (e) {
      assert.match(e.message, /unsupported data storage type/i);
    }
  });
});
