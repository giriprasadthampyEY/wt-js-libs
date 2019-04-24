import { assert } from 'chai';
import sinon from 'sinon';
import { WtJsLibs } from '../../src/index';
import { TrustClueClient } from '../../src/trust-clue-client';
import testedDataModel from '../utils/data-hotel-model-definition';

describe('WtJsLibs usage', () => {
  let libs,
    // this depends on the migrations and might not work
    minedTxHashes = [
      '0x0e0174fd2bab6e9ce34ba1bdbce6e143e60bb7a1ecc4b3be9e11a42da329918d',
      '0x0960aeea844d85921619052ec7acd1f19e64d0e041416eaae812f5e2842dbb00',
    ];

  beforeEach(() => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
  });

  describe('getTransactionsStatus', () => {
    it('should return transaction status', async () => {
      let result = await libs.getTransactionsStatus(minedTxHashes);
      assert.isDefined(result.meta);
      assert.equal(result.meta.total, minedTxHashes.length);
      assert.equal(result.meta.processed, minedTxHashes.length);
      assert.equal(result.meta.allPassed, true);
      for (let hash of minedTxHashes) {
        assert.isDefined(result.results[hash]);
        assert.isDefined(result.results[hash].transactionHash);
        assert.isDefined(result.results[hash].from);
        assert.isDefined(result.results[hash].to);
        assert.isDefined(result.results[hash].blockAge);
        assert.isDefined(result.results[hash].decodedLogs);
        assert.isDefined(result.results[hash].raw);
      }
    });

    it('should return nothing if transactions do not exist', async () => {
      let result = await libs.getTransactionsStatus(['random-tx', 'another-random-tx']);
      assert.isDefined(result.meta);
      assert.equal(result.meta.total, 2);
      assert.equal(result.meta.processed, 0);
      assert.equal(result.meta.allPassed, false);
      assert.deepEqual(result.results, {});
    });
  });

  describe('getTrustClueClient', () => {
    it('should return a trust client instance', () => {
      const client = libs.getTrustClueClient();
      assert.isDefined(client.getClue);
    });

    it('should cache the instance', () => {
      const createSpy = sinon.spy(TrustClueClient, 'createInstance');
      const client = libs.getTrustClueClient();
      assert.equal(createSpy.callCount, 1);
      assert.isDefined(client.getClue);
      libs.getTrustClueClient();
      assert.equal(createSpy.callCount, 1);
      TrustClueClient.createInstance.restore();
    });
  });
});
