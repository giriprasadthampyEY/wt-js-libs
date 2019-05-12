import { assert } from 'chai';
import sinon from 'sinon';
import Web3Utils from 'web3-utils';
import Web3Eth from 'web3-eth';
import { TrustClueClient } from '../../src/trust-clue-client';
import { TrustClueRuntimeError, TrustClueConfigurationError } from '../../src/trust-clue-client/errors';
import wallet from '../utils/test-wallet';

class TestList {
  getMetadata () {
    return { name: 'testList', description: 'description' };
  }
  getValueFor (addr) {
    if (addr === 42) { return Promise.reject(new Error('fish')); }
    return Promise.resolve(`123+${addr}`);
  }
  interpretValueFor (addr) {
    if (addr === 42) { return Promise.reject(new Error('fish')); }
    return Promise.resolve(addr % 2);
  }
}

class MyList {
  getMetadata () {
    return { name: 'myList', description: 'description' };
  }
  getValueFor (addr) {
    return Promise.resolve(`456+${addr}`);
  }
  interpretValueFor (addr) {
    return Promise.resolve(addr % 2 > 0);
  }
}

describe('WTLibs.TrustClueClient', () => {
  let client, createTestListStub, createMyListStub;

  beforeEach(() => {
    createTestListStub = sinon.stub().returns(new TestList());
    createMyListStub = sinon.stub().returns(new MyList());
    client = TrustClueClient.createInstance({
      provider: 'http://localhost:8545',
      clues: {
        'test-list': {
          options: {
            opt1: 'val',
          },
          create: createTestListStub,
        },
        'my-list': {
          options: {
            opt1: 'val',
          },
          create: createMyListStub,
        },
      },
    });
  });

  afterEach(() => {
    createTestListStub.resetHistory();
    createMyListStub.resetHistory();
  });

  describe('instantiation', () => {
    it('should pass along options', async () => {
      const clue = await client.getClue('test-list');
      assert.isDefined(clue);
      assert.isDefined(clue.getMetadata);
      assert.equal(createTestListStub.firstCall.args[0].opt1, 'val');
    });

    it('should throw when clue names are ambiguous', () => {
      assert.throws(() =>
        TrustClueClient.createInstance({
          provider: 'aaa',
          clues: {
            'test-list': { create: () => { return new TestList(); } },
            'TEST-LIST': { create: () => { return new TestList(); } },
          },
        }), TrustClueConfigurationError, /Clue declared twice/);
    });
  });

  describe('getClue', () => {
    it('should return proper clue', async () => {
      const clue = await client.getClue('test-list');
      assert.isDefined(clue);
      assert.isDefined(clue.getMetadata);
    });

    it('should be case insensitive', async () => {
      const clue = await client.getClue('TEST-LIst');
      assert.isDefined(clue);
      assert.isDefined(clue.getMetadata);
    });

    it('should cache instantiated clues', async () => {
      let clue = await client.getClue('test-list');
      assert.isDefined(clue);
      assert.isDefined(clue.getMetadata);
      assert.equal(createTestListStub.callCount, 1);
      clue = await client.getClue('test-list');
      assert.isDefined(clue);
      assert.isDefined(clue.getMetadata);
      assert.equal(createTestListStub.callCount, 1);
    });

    it('should throw when no clue is found for given name', async () => {
      try {
        await client.getClue('non-existent');
        assert(false);
      } catch (e) {
        assert.match(e.message, /unsupported trust clue type/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });
  });

  describe('getAllValues', () => {
    it('should return values for all configured clues', async () => {
      const values = await client.getAllValues(3);
      assert.equal(values.length, 2);
      assert.equal(values[0].name, 'test-list');
      assert.equal(values[0].value, '123+3');
      assert.isUndefined(values[0].error);
      assert.equal(values[1].name, 'my-list');
      assert.equal(values[1].value, '456+3');
      assert.isUndefined(values[1].error);
    });

    it('should not crash when one clue crashes but return errors instead', async () => {
      const values = await client.getAllValues(42);
      assert.equal(values.length, 2);
      assert.equal(values[0].name, 'test-list');
      assert.match(values[0].error, /fish/);
      assert.isUndefined(values[0].value);
      assert.equal(values[1].name, 'my-list');
      assert.equal(values[1].value, '456+42');
      assert.isUndefined(values[1].error);
    });
  });

  describe('interpretAllValues', () => {
    it('should return values for all configured clues', async () => {
      const values = await client.interpretAllValues(3);
      assert.equal(values.length, 2);
      assert.equal(values[0].name, 'test-list');
      assert.equal(values[0].value, 1);
      assert.isUndefined(values[0].error);
      assert.equal(values[1].name, 'my-list');
      assert.equal(values[1].value, true);
      assert.isUndefined(values[1].error);
    });

    it('should not crash when one clue crashes but return errors instead', async () => {
      const values = await client.interpretAllValues(42);
      assert.equal(values.length, 2);
      assert.equal(values[0].name, 'test-list');
      assert.match(values[0].error, /fish/);
      assert.isUndefined(values[0].value);
      assert.equal(values[1].name, 'my-list');
      assert.equal(values[1].value, false);
      assert.isUndefined(values[1].error);
    });
  });

  describe('verifyAndDecodeSignedData', () => {
    let data, signedData, signature;

    beforeAll(() => {
      data = {
        id: '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906',
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const web3eth = new Web3Eth('http://localhost:8545');
      const decryptedWallet = web3eth.accounts.decrypt(wallet, 'test123');
      signedData = Web3Utils.utf8ToHex(JSON.stringify(data));
      const signingResult = decryptedWallet.sign(signedData);
      signature = signingResult.signature;
    });

    it('should return the decoded data if everything goes well', () => {
      const result = client.verifyAndDecodeSignedData(signedData, signature, 'id');
      assert.equal(result.id, data.id);
      assert.equal(result.data.random, data.data.random);
      assert.equal(result.data.winding, data.data.winding);
    });

    it('should not fail when address in signerField is not checksummed', () => {
      const myData = {
        id: '0xd39ca7d186A37BB6bf48ae8abfeb4c687dc8f906',
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const web3eth = new Web3Eth('http://localhost:8545');
      const decryptedWallet = web3eth.accounts.decrypt(wallet, 'test123');
      const mySignedData = Web3Utils.utf8ToHex(JSON.stringify(myData));
      const signingResult = decryptedWallet.sign(mySignedData);
      const mySignature = signingResult.signature;
      const result = client.verifyAndDecodeSignedData(mySignedData, mySignature, 'id');
      assert.equal(result.id, myData.id);
      assert.equal(result.data.random, myData.data.random);
      assert.equal(result.data.winding, myData.data.winding);
    });

    it('should throw when signerField does not contain address', () => {
      const myData = {
        id: '0xd39ca7d186A37BB6bf48ae8abfeb4c687dc8f906',
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const web3eth = new Web3Eth('http://localhost:8545');
      const decryptedWallet = web3eth.accounts.decrypt(wallet, 'test123');
      const mySignedData = Web3Utils.utf8ToHex(JSON.stringify(myData));
      const signingResult = decryptedWallet.sign(mySignedData);
      const mySignature = signingResult.signature;
      try {
        client.verifyAndDecodeSignedData(mySignedData, mySignature, 'id');
      } catch (e) {
        assert.match(e.message, /ethereum address/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should throw when any of the arguments is missing', () => {
      try {
        client.verifyAndDecodeSignedData(undefined, signature, 'id');
        assert(false);
      } catch (e) {
        assert.match(e.message, /signedData/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }

      try {
        client.verifyAndDecodeSignedData(signedData, undefined, 'id');
        assert(false);
      } catch (e) {
        assert.match(e.message, /signature/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }

      try {
        client.verifyAndDecodeSignedData(signedData, signature);
        assert(false);
      } catch (e) {
        assert.match(e.message, /signerField/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should not accept not-hex encoded signedData', () => {
      try {
        client.verifyAndDecodeSignedData('random data', signature, 'id');
        assert(false);
      } catch (e) {
        assert.match(e.message, /signedData/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should not accept not-hex encoded signature', () => {
      try {
        client.verifyAndDecodeSignedData(signedData, 'random string', 'id');
      } catch (e) {
        assert.match(e.message, /signature/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should throw when decoded signedData is not a valid JSON', () => {
      const myData = '0xd39ca7d186A37BB6bf48ae8abfeb4c687dc8f906';
      const web3eth = new Web3Eth('http://localhost:8545');
      const decryptedWallet = web3eth.accounts.decrypt(wallet, 'test123');
      const mySignedData = Web3Utils.utf8ToHex(myData);
      const signingResult = decryptedWallet.sign(mySignedData);
      const mySignature = signingResult.signature;
      try {
        client.verifyAndDecodeSignedData(mySignedData, mySignature, 'id');
        assert(false);
      } catch (e) {
        assert.match(e.message, /signedData does not seem to be a valid json/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should throw when signerField is not present in the decoded data', () => {
      const myData = {
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const web3eth = new Web3Eth('http://localhost:8545');
      const decryptedWallet = web3eth.accounts.decrypt(wallet, 'test123');
      const mySignedData = Web3Utils.utf8ToHex(JSON.stringify(myData));
      const signingResult = decryptedWallet.sign(mySignedData);
      const mySignature = signingResult.signature;
      try {
        client.verifyAndDecodeSignedData(mySignedData, mySignature, 'id');
        assert(false);
      } catch (e) {
        assert.match(e.message, /signerField 'id' is not part of the decoded data/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should throw when address recovery fails', () => {
      try {
        client.verifyAndDecodeSignedData(signedData, '0x', 'id');
        assert(false);
      } catch (e) {
        assert.match(e.message, /recovery/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should throw when recovered address does not match signerField', () => {
      const myData = {
        id: '04e46f24307e4961157b986a0b653a0d88f9dbd6',
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const web3eth = new Web3Eth('http://localhost:8545');
      const decryptedWallet = web3eth.accounts.decrypt(wallet, 'test123');
      const mySignedData = Web3Utils.utf8ToHex(JSON.stringify(myData));
      const signingResult = decryptedWallet.sign(mySignedData);
      const mySignature = signingResult.signature;
      try {
        client.verifyAndDecodeSignedData(mySignedData, mySignature, 'id');
        assert(false);
      } catch (e) {
        assert.match(e.message, /expected signer/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });
  });

  describe('getMetadataForAllClues', () => {
    it('should return metadata for all clues', async () => {
      const values = await client.getMetadataForAllClues();
      assert.equal(values.length, 2);
      assert.equal(values[0].name, 'testList');
      assert.equal(values[0].description, 'description');
      assert.equal(values[1].name, 'myList');
      assert.equal(values[1].description, 'description');
    });
  });
});
