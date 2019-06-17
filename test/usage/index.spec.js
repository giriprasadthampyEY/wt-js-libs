import { assert } from 'chai';
import sinon from 'sinon';
import { WtJsLibs } from '../../src/index';
import { TrustClueClient } from '../../src/trust-clue-client';
import testedDataModel from '../utils/data-hotel-model-definition';

describe('WtJsLibs usage', () => {
  let libs,
    // this depends on the migrations and might not work
    minedTxHashes = [
      '0x5c3c1ed9271398db1d12c911ef53ba458f24342436a0c0067645121f57998048',
      '0xba042bbc73142dc54f9217b71574e7b58aa1e8bc87f9c6ac59d1fd9c5e03bec1',
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
