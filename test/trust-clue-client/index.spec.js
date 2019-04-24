import { assert } from 'chai';
import sinon from 'sinon';
import { TrustClueClient } from '../../src/trust-clue-client';
import { TrustClueRuntimeError, TrustClueConfigurationError } from '../../src/trust-clue-client/errors';

class TestList {
  getMetadata () {
    return { name: 'testList', description: 'description' };
  }
}
 
describe('WTLibs.TrustClueClient', () => {
  let client, createStub;

  beforeEach(() => {
    createStub = sinon.stub().returns(new TestList());
    client = TrustClueClient.createInstance({
      clues: {
        'test-list': {
          options: {
            opt1: 'val',
          },
          create: createStub,
        },
      },
    });
  });

  afterEach(() => {
    createStub.resetHistory();
  });

  it('should return proper clue', () => {
    const clue = client.getClue('test-list');
    assert.isDefined(clue);
    assert.isDefined(clue.getMetadata);
  });

  it('should be case insensitive', () => {
    const clue = client.getClue('TEST-LIst');
    assert.isDefined(clue);
    assert.isDefined(clue.getMetadata);
  });

  it('should pass along options', () => {
    const clue = client.getClue('test-list');
    assert.isDefined(clue);
    assert.isDefined(clue.getMetadata);
    assert.equal(createStub.firstCall.args[0].opt1, 'val');
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

  it('should cache instantiated clues', () => {
    let clue = client.getClue('test-list');
    assert.isDefined(clue);
    assert.isDefined(clue.getMetadata);
    assert.equal(createStub.callCount, 1);
    clue = client.getClue('test-list');
    assert.isDefined(clue);
    assert.isDefined(clue.getMetadata);
    assert.equal(createStub.callCount, 1);
  });

  it('should throw when no clue is found for given name', () => {
    try {
      client.getClue('non-existent');
      assert(false);
    } catch (e) {
      assert.match(e.message, /unsupported trust clue type/i);
      assert.instanceOf(e, TrustClueRuntimeError);
    }
  });
});
