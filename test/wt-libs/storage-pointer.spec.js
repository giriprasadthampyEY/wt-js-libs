import { assert } from 'chai';
import sinon from 'sinon';
import StoragePointer from '../../src/storage-pointer';
import OffChainDataClient from '../../src/off-chain-data-client';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';
import { StoragePointerError, OffChainDataRuntimeError } from '../../src/errors';

describe('WTLibs.StoragePointer', () => {
  beforeEach(() => {
    OffChainDataClient.setup({
      adapters: {
        'in-memory': {
          create: () => {
            return new InMemoryAdapter();
          },
        },
        'bzz-raw': {
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

  describe('initialization', () => {
    it('should work well with unique child names', () => {
      const pointer = StoragePointer.createInstance('in-memory://url', { one: {}, two: {} });
      assert.isDefined(pointer._children.one);
      assert.isDefined(pointer._children.two);
    });

    it('should throw on name conflicts', () => {
      assert.throws(() => {
        StoragePointer.createInstance('in-memory://url', { one: {}, ONE: {} });
      }, StoragePointerError, /conflict in field names/i);
    });

    it('should work well with empty children list', () => {
      assert.doesNotThrow(() => {
        StoragePointer.createInstance('in-memory://url');
      });
    });

    it('should throw on an empty uri', () => {
      assert.throws(() => {
        StoragePointer.createInstance('');
      }, StoragePointerError, /without uri/i);

      assert.throws(() => {
        StoragePointer.createInstance();
      }, StoragePointerError, /without uri/i);
    });

    it('should properly set ref and contents', () => {
      const pointer = StoragePointer.createInstance('in-memory://url');
      assert.equal(pointer.ref, 'in-memory://url');
      assert.isDefined(pointer.contents);
    });

    it('should throw if StoragePointer cannot be set up due to bad uri format', async () => {
      try {
        const pointer = StoragePointer.createInstance('jsonxxurl');
        await pointer.contents;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /unsupported data storage type/i);
      }
    });

    it('should properly setup defaults as required', () => {
      const pointer = StoragePointer.createInstance('in-memory://url', {
        sp: {},
      });
      assert.equal(pointer._children.sp.required, true);
    });

    it('should properly setup required', () => {
      const pointer = StoragePointer.createInstance('in-memory://url', {
        sp: { required: false },
      });
      assert.equal(pointer._children.sp.required, false);
    });

    it('should properly setup nested', () => {
      const pointer = StoragePointer.createInstance('in-memory://url', {
        sp: { nested: true },
      });
      assert.equal(pointer._children.sp.nested, true);
    });
  });

  describe('data downloading', () => {
    it('should not download the data immediately', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url');
      const dldSpy = sinon.spy(pointer, '_downloadFromStorage');
      assert.equal(dldSpy.callCount, 0);
      await pointer.contents;
      assert.equal(dldSpy.callCount, 1);
      await pointer.contents;
      assert.equal(dldSpy.callCount, 1);
    });

    it('should properly instantiate OffChainDataAdapter', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url');
      assert.isUndefined(pointer._adapter);
      await pointer.contents;
      assert.isDefined(pointer._adapter);
    });

    it('should reuse OffChainDataAdapter instance', async () => {
      const getAdapterSpy = sinon.spy(OffChainDataClient, 'getAdapter');
      const pointer = StoragePointer.createInstance('in-memory://url');
      assert.equal(getAdapterSpy.callCount, 0);
      await pointer.contents;
      assert.equal(getAdapterSpy.callCount, 1);
      await pointer._getOffChainDataClient();
      assert.equal(getAdapterSpy.callCount, 1);
      getAdapterSpy.restore();
    });

    it('should throw when an unsupported schema is encountered', async () => {
      try {
        const pointer = StoragePointer.createInstance('random://url');
        await pointer.contents;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /unsupported data storage type/i);
        assert.instanceOf(e, OffChainDataRuntimeError);
      }
    });

    it('should throw when the adapter throws on download', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url-1234');
      sinon.stub(OffChainDataClient, 'getAdapter').returns({
        download: sinon.stub().rejects(),
      });
      try {
        await pointer.contents;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /cannot download data/i);
        assert.instanceOf(e, StoragePointerError);
      } finally {
        OffChainDataClient.getAdapter.restore();
      }
    });

    it('should not panic on schema with a dash in it', async () => {
      const pointer = StoragePointer.createInstance('bzz-raw://url');
      assert.isUndefined(pointer._adapter);
      await pointer.contents;
      assert.isDefined(pointer._adapter);
    });
  });

  describe('recursion', () => {
    it('should recursively instantiate another StoragePointer', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', { sp: {} });
      sinon.stub(pointer, '_getOffChainDataClient').returns({
        download: sinon.stub().returns({
          'sp': 'in-memory://point',
        }),
      });
      assert.equal(pointer.ref, 'in-memory://url');
      const recursivePointer = (await pointer.contents).sp;
      assert.equal(recursivePointer.constructor.name, 'StoragePointer');
      assert.equal(recursivePointer.ref, 'in-memory://point');
      assert.isDefined(recursivePointer.contents);
    });

    it('should work well with nested storage pointers', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', { sp: { nested: true } });
      sinon.stub(pointer, '_getOffChainDataClient').returns({
        download: sinon.stub().returns({
          'sp': {
            key1: 'in-memory://point1',
            key2: 'in-memory://point2',
          },
        }),
      });
      assert.equal(pointer.ref, 'in-memory://url');
      const sp = (await pointer.contents).sp;
      assert.equal(sp.key1.constructor.name, 'StoragePointer');
      assert.equal(sp.key2.constructor.name, 'StoragePointer');
      assert.equal(sp.key1.ref, 'in-memory://point1');
      assert.equal(sp.key2.ref, 'in-memory://point2');
      assert.isDefined(sp.key1.contents);
      assert.isDefined(sp.key2.contents);
    });

    it('should not panic if a non-required recursive StoragePointer is missing', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', {
        sp: { required: false },
      });
      sinon.stub(pointer, '_getOffChainDataClient').returns({
        download: sinon.stub().returns({}),
      });
      await pointer.contents;
    });

    it('should throw if recursive StoragePointer cannot be set up due to null pointer value', async () => {
      try {
        const pointer = StoragePointer.createInstance('in-memory://url', { sp: {} });
        await pointer.contents;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /which is required/i);
      }
    });

    it('should throw if recursive StoragePointer cannot be set up due to a malformed pointer value', async () => {
      try {
        const pointer = StoragePointer.createInstance('in-memory://url', { sp: {} });
        sinon.stub(pointer, '_getOffChainDataClient').returns({
          download: sinon.stub().returns({
            'sp': { some: 'field' },
          }),
        });
        await pointer.contents;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /which does not appear to be of type string/i);
      }
    });

    it('should throw if recursive nested StoragePointer cannot be set up due to a malformed pointer value', async () => {
      try {
        const pointer = StoragePointer.createInstance('in-memory://url', { sp: { nested: true } });
        sinon.stub(pointer, '_getOffChainDataClient').returns({
          download: sinon.stub().returns({
            'sp': {
              key1: { dummy: 'dummy' },
              key2: { dummy: 'dummy' },
            },
          }),
        });
        await pointer.contents;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /which does not appear to be of type string/i);
      }
    });

    it('should throw if recursive StoragePointer cannot be set up due to bad schema', async () => {
      try {
        const pointer = StoragePointer.createInstance('in-memory://url', { sp: {} });
        sinon.stub(pointer, '_getOffChainDataClient').returns({
          download: sinon.stub().returns({
            'sp': 'random://point',
          }),
        });
        assert.equal(pointer.ref, 'in-memory://url');
        const contents = await pointer.contents;
        await contents.sp.contents;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /unsupported data storage type/i);
      }
    });
  });

  describe('reset()', () => {
    it('should force repeated download', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url');
      const adapter = await pointer._getOffChainDataClient();
      const dldSpy = sinon.spy(adapter, 'download');
      assert.equal(dldSpy.callCount, 0);
      await pointer.contents;
      assert.equal(dldSpy.callCount, 1);
      await pointer.contents;
      assert.equal(dldSpy.callCount, 1);
      await pointer.reset();
      assert.equal(dldSpy.callCount, 1);
      await pointer.contents;
      assert.equal(dldSpy.callCount, 2);
    });

    it('should allow repeated reset', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url');
      const adapter = await pointer._getOffChainDataClient();
      const dldSpy = sinon.spy(adapter, 'download');
      await pointer.contents;
      assert.equal(dldSpy.callCount, 1);
      await pointer.reset();
      await pointer.reset();
      await pointer.reset();
      await pointer.contents;
      assert.equal(dldSpy.callCount, 2);
    });
  });

  describe('toPlainObject', () => {
    let pointer, hashKey1, hashKey2, hashLevelZero, hashLevelOne, hashLevelTwo, hashLevelThree;
    before(() => {
      hashKey1 = InMemoryAdapter.storageInstance.create({ value: 'value1' });
      hashKey2 = InMemoryAdapter.storageInstance.create({ value: 'value2' });
      hashLevelThree = InMemoryAdapter.storageInstance.create({ below: 'cows', above: 'sheep' });
      hashLevelTwo = InMemoryAdapter.storageInstance.create({ one: 'bunny', two: 'frogs', below: `in-memory://${hashLevelThree}` });
      hashLevelOne = InMemoryAdapter.storageInstance.create({ three: 'dogs', four: 'donkeys', five: `in-memory://${hashLevelTwo}` });
      hashLevelZero = InMemoryAdapter.storageInstance.create({
        six: 'horses',
        seven: 'cats',
        eight: `in-memory://${hashLevelOne}`,
        nine: `in-memory://${hashLevelTwo}`,
        ten: {
          key1: `in-memory://${hashKey1}`,
          key2: `in-memory://${hashKey2}`,
        },
      });
      pointer = StoragePointer.createInstance(`in-memory://${hashLevelZero}`, {
        eight: {
          children: {
            five: {
              children: {
                below: {},
              },
            },
          },
        },
        nine: {
          children: {
            below: {},
          },
        },
        ten: { nested: true },
      });
    });

    it('should return a complete data tree without arguments', async () => {
      const pojo = await pointer.toPlainObject();
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');
      assert.equal(pojo.contents.nine.contents.one, 'bunny');
      assert.equal(pojo.contents.nine.contents.two, 'frogs');
      assert.equal(pojo.contents.nine.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.nine.contents.below.contents.above, 'sheep');
      assert.equal(pojo.contents.ten.key1.contents.value, 'value1');
      assert.equal(pojo.contents.ten.key2.contents.value, 'value2');
    });

    it('should limit resolved fields', async () => {
      const pojo = await pointer.toPlainObject(['eight']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');
      assert.equal(pojo.contents.nine, `in-memory://${hashLevelTwo}`);
      assert.deepEqual(pojo.contents.ten, {
        key1: `in-memory://${hashKey1}`,
        key2: `in-memory://${hashKey2}`,
      });
    });

    it('should resolve multiple recursive fields', async () => {
      const pojo = await pointer.toPlainObject(['eight.five.two', 'nine.below.above']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.nine.contents.one, 'bunny');
      assert.equal(pojo.contents.nine.contents.below.contents.above, 'sheep');
    });

    it('should resolve field on a second level', async () => {
      const pojo = await pointer.toPlainObject(['eight.four', 'eight.three']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five, `in-memory://${hashLevelTwo}`);
    });

    it('should resolve field on a second level when asked for multiple times', async () => {
      const pojo = await pointer.toPlainObject(['eight.five']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.isDefined(pojo.contents.eight.contents.five);
      assert.equal(pojo.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');

      const pojo2 = await pointer.toPlainObject(['eight.five.one']);
      assert.equal(pojo2.contents.six, 'horses');
      assert.equal(pojo2.contents.seven, 'cats');
      assert.isDefined(pojo2.contents.eight);
      assert.equal(pojo2.contents.eight.contents.three, 'dogs');
      assert.equal(pojo2.contents.eight.contents.four, 'donkeys');
      assert.isDefined(pojo2.contents.eight.contents.five);
      assert.equal(pojo2.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo2.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');
    });

    it('should resolve a `nested` pointer', async () => {
      const pojo = await pointer.toPlainObject(['ten']);
      assert.deepEqual(pojo.contents.ten.key1.contents, { value: 'value1' });
      assert.deepEqual(pojo.contents.ten.key2.contents, { value: 'value2' });
    });

    it('should allow the user to not resolve any field', async () => {
      const pojo = await pointer.toPlainObject([]);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.equal(pojo.contents.eight, `in-memory://${hashLevelOne}`);
      assert.equal(pojo.contents.nine, `in-memory://${hashLevelTwo}`);
    });

    it('should not report undefined for missing fields', async () => {
      const hash = InMemoryAdapter.storageInstance.create({ six: 'horses', seven: 'cats', nine: undefined });
      const pointer = StoragePointer.createInstance(`in-memory://${hash}`);
      const pojo = await pointer.toPlainObject();
      assert.property(pojo.contents, 'six');
      assert.property(pojo.contents, 'seven');
      assert.notProperty(pojo.contents, 'eight');
      assert.property(pojo.contents, 'nine');
      assert.isUndefined(pojo.contents.nine);
    });
  });
});
