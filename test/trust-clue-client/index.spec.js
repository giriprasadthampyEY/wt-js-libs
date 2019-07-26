import { assert } from 'chai';
import sinon from 'sinon';
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

  describe('verifySignedData', () => {
    let data, serializedData, signature, decryptedWallet;

    beforeAll(() => {
      data = {
        signer: '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906',
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const web3eth = new Web3Eth('http://localhost:8545');
      decryptedWallet = web3eth.accounts.decrypt(wallet, 'test123');
      serializedData = JSON.stringify(data);
      const signingResult = decryptedWallet.sign(serializedData);
      signature = signingResult.signature;
    });

    it('should not throw if everything goes well with default verificationFn', async () => {
      return client.verifySignedData(serializedData, signature);
    });

    it('should not fail when address in signer field is not checksummed and no custom verificationFn is used', async () => {
      const myData = {
        signer: '0xd39ca7d186A37BB6bf48ae8abfeb4c687dc8f906',
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const serializedData = JSON.stringify(myData);
      const signingResult = decryptedWallet.sign(serializedData);
      return client.verifySignedData(serializedData, signingResult.signature);
    });

    it('should throw when signer field does not contain address', async () => {
      const myData = {
        signer: 'aaaaaaaaaaaaaa',
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const mySerializedData = JSON.stringify(myData);
      const signingResult = decryptedWallet.sign(mySerializedData);
      try {
        await client.verifySignedData(mySerializedData, signingResult.signature);
      } catch (e) {
        assert.match(e.message, /ethereum address/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should call custom verificationFn', async () => {
      const verificationFn = sinon.stub().returns(true);
      await client.verifySignedData(serializedData, signature, verificationFn);
      assert.equal(verificationFn.callCount, 1);
      const throwingVerificationFn = sinon.stub().throws(new Error('random error'));
      try {
        await client.verifySignedData(serializedData, signature, throwingVerificationFn);
        assert(false);
      } catch (e) {
        assert.equal(throwingVerificationFn.callCount, 1);
        assert.match(e.message, /random error/i);
      }
    });

    it('should work with async custom verificationFn', async () => {
      const verificationFn = sinon.stub().resolves(true);
      await client.verifySignedData(serializedData, signature, verificationFn);
      assert.equal(verificationFn.callCount, 1);
      const throwingVerificationFn = sinon.stub().throws(new Error('random error'));
      try {
        await client.verifySignedData(serializedData, signature, throwingVerificationFn);
        assert(false);
      } catch (e) {
        assert.equal(throwingVerificationFn.callCount, 1);
        assert.match(e.message, /random error/i);
      }
    });

    it('should throw when any of the required arguments is missing', async () => {
      try {
        await client.verifySignedData(undefined, signature);
        assert(false);
      } catch (e) {
        assert.match(e.message, /serializedData/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }

      try {
        await client.verifySignedData(serializedData, undefined);
        assert(false);
      } catch (e) {
        assert.match(e.message, /signature/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should not accept not-hex encoded signature', async () => {
      try {
        await client.verifySignedData(serializedData, 'random string');
      } catch (e) {
        assert.match(e.message, /signature/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should fail verification when serializedData is not a valid JSON with default verification function', async () => {
      const mySerializedData = '0xd39ca7d186A37BB6bf48ae8abfeb4c687dc8f906';
      const signingResult = decryptedWallet.sign(mySerializedData);
      const mySignature = signingResult.signature;
      try {
        await client.verifySignedData(mySerializedData, mySignature);
        assert(false);
      } catch (e) {
        assert.match(e.message, /verification function failed/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
      try {
        await client.verifySignedData(mySerializedData, mySignature, () => {});
      } catch (e) {
        assert(false);
      }
    });

    it('should fail verification when signer field is not present with default validation function', async () => {
      const myData = {
        data: {
          random: 'thing',
          winding: 'tree',
        },
      };
      const mySerializedData = JSON.stringify(myData);
      const signingResult = decryptedWallet.sign(mySerializedData);
      try {
        await client.verifySignedData(mySerializedData, signingResult.signature);
        assert(false);
      } catch (e) {
        assert.match(e.message, /verification function failed/i);
        assert.instanceOf(e, TrustClueRuntimeError);
      }
    });

    it('should throw when address recovery fails', async () => {
      try {
        await client.verifySignedData(serializedData, '0x');
        assert(false);
      } catch (e) {
        assert.match(e.message, /recovery/i);
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
