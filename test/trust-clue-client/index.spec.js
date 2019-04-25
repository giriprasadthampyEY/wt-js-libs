import { assert } from 'chai';
import sinon from 'sinon';
import { TrustClueClient } from '../../src/trust-clue-client';
import { TrustClueRuntimeError, TrustClueConfigurationError } from '../../src/trust-clue-client/errors';

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
});
