import { assert } from 'chai';
import sinon from 'sinon';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';
import StoragePointer from '../../src/on-chain-data/storage-pointer';
import { StoragePointerError } from '../../src/on-chain-data/errors';
import { OffChainDataClient } from '../../src/off-chain-data-client';
import { OffChainDataRuntimeError } from '../../src/off-chain-data-client/errors';

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

  describe('toPlainObject()', () => {
    let pointer, hashKey1, hashKey2, hashLevelZero, hashLevelOne, hashLevelTwo, hashLevelThree,
      topLevelArrayHash, arrayInsideHash;
    beforeAll(() => {
      topLevelArrayHash = InMemoryAdapter.storageInstance.create([
        { type: 'cat', name: 'Garfield' },
        { type: 'dog', name: 'Odie' },
        { type: 'human', name: 'Jon' },
      ]);
      arrayInsideHash = InMemoryAdapter.storageInstance.create({
        publisher: 'Random House',
        members: [
          { type: 'cat', name: 'Garfield' },
          { type: 'dog', name: 'Odie' },
          { type: 'human', name: 'Jon' },
        ],
      });
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
          key3: `in-memory://${topLevelArrayHash}`,
          key4: `in-memory://${arrayInsideHash}`,
        },
        eleven: `in-memory://${topLevelArrayHash}`,
        twelve: `in-memory://${arrayInsideHash}`,
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
        eleven: {},
        twelve: {},
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

    it('should work for arrays on top level of the document', async () => {
      const pojo = await pointer.toPlainObject(['eleven']);
      assert.equal(pojo.contents.eleven.contents.length, 3);
      assert.equal(pojo.contents.eleven.contents[0].name, 'Garfield');
      assert.equal(pojo.contents.eleven.contents[1].name, 'Odie');
      assert.equal(pojo.contents.eleven.contents[2].name, 'Jon');
    });

    it('should work for arrays inside the document', async () => {
      const pojo = await pointer.toPlainObject(['twelve']);
      assert.equal(pojo.contents.twelve.contents.publisher, 'Random House');
      assert.equal(pojo.contents.twelve.contents.members.length, 3);
      assert.equal(pojo.contents.twelve.contents.members[0].name, 'Garfield');
      assert.equal(pojo.contents.twelve.contents.members[1].name, 'Odie');
      assert.equal(pojo.contents.twelve.contents.members[2].name, 'Jon');
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
        key3: `in-memory://${topLevelArrayHash}`,
        key4: `in-memory://${arrayInsideHash}`,
      });
    });

    it('should limit resolved fields by depth=0', async () => {
      const pojo = await pointer.toPlainObject(undefined, 0);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.isUndefined(pojo.contents.eight.contents);
      assert.isTrue(pojo.contents.eight.startsWith('in-memory://'));
      assert.isTrue(pojo.contents.nine.startsWith('in-memory://'));
      assert.deepEqual(pojo.contents.ten, {
        key1: `in-memory://${hashKey1}`,
        key2: `in-memory://${hashKey2}`,
        key3: `in-memory://${topLevelArrayHash}`,
        key4: `in-memory://${arrayInsideHash}`,
      });
    });

    it('should limit resolved fields by depth=1', async () => {
      const pojo = await pointer.toPlainObject(undefined, 1);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.isTrue(pojo.contents.eight.contents.five.startsWith('in-memory://'));
      assert.equal(pojo.contents.nine.contents.one, 'bunny');
      assert.equal(pojo.contents.nine.contents.two, 'frogs');
      assert.isTrue(pojo.contents.nine.contents.below.startsWith('in-memory://'));
      assert.deepEqual(pojo.contents.ten, {
        key1: `in-memory://${hashKey1}`,
        key2: `in-memory://${hashKey2}`,
        key3: `in-memory://${topLevelArrayHash}`,
        key4: `in-memory://${arrayInsideHash}`,
      });
    });

    it('should limit resolved fields by depth=2', async () => {
      const pojo = await pointer.toPlainObject(undefined, 2);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo.contents.nine.contents.one, 'bunny');
      assert.equal(pojo.contents.nine.contents.two, 'frogs');
      assert.isDefined(pojo.contents.nine.contents.below.contents);
      assert.isDefined(pojo.contents.ten.key1.contents);
      assert.isDefined(pojo.contents.ten.key2.contents);
      assert.isDefined(pojo.contents.ten.key3.contents);
      assert.isDefined(pojo.contents.ten.key4.contents);
      assert.equal(pojo.contents.ten.key1.contents.value, 'value1');
      assert.equal(pojo.contents.ten.key2.contents.value, 'value2');
      assert.equal(pojo.contents.ten.key3.contents.length, 3);
      assert.equal(pojo.contents.ten.key4.contents.publisher, 'Random House');
    });

    it('should throw for nested pointer that actually contains array', async () => {
      const hash = InMemoryAdapter.storageInstance.create({
        ten: [
          { okey: 'dokey' },
        ],
      });
      const ptr = StoragePointer.createInstance(`in-memory://${hash}`, {
        ten: { nested: true },
      });
      try {
        await ptr.toPlainObject();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot be an array/i);
      }
    });

    it('should accept an array of objects that contain pointers', async () => {
      const childHash1 = InMemoryAdapter.storageInstance.create({
        number: 23,
      });
      const childHash2 = InMemoryAdapter.storageInstance.create({
        number: 42,
      });
      const hash = InMemoryAdapter.storageInstance.create({
        array: [
          { valueUri: `in-memory://${childHash1}` },
          { valueUri: `in-memory://${childHash2}` },
        ],
      });
      const ptr = StoragePointer.createInstance(`in-memory://${hash}`, {
        array: { children: { valueUri: { required: true } } },
      });
      let data = await ptr.toPlainObject();
      assert.equal(data.contents.array[0].valueUri.contents.number, 23);
      assert.equal(data.contents.array[1].valueUri.contents.number, 42);
    });

    it('should accept recursive references, both with/without toPlainObject', async () => {
      const innerUri = InMemoryAdapter.storageInstance.create({
        data: 'wt',
      });
      const outerUri = InMemoryAdapter.storageInstance.create({
        detail: `in-memory://${innerUri}`,
        bar: 'foo',
      });
      const pointer = StoragePointer.createInstance(`in-memory://${outerUri}`, {
        detail: {
          children: {},
        },
      });
      // direct access
      assert.equal(pointer.ref, `in-memory://${outerUri}`);
      let contents = await pointer.contents;
      assert.equal(contents.bar, 'foo');
      assert.equal(contents.detail.ref, `in-memory://${innerUri}`);
      assert.equal((await contents.detail.contents).data, 'wt');

      // toPlainObject
      let plainObject = await pointer.toPlainObject();
      assert.equal(plainObject.contents.bar, 'foo');
      assert.equal(plainObject.contents.detail.contents.data, 'wt');
    });

    it('should work with flights and instances', async () => {
      const flightInstancesHash = InMemoryAdapter.storageInstance.create([{
        id: 'IeKeix6G-1',
        departureDateTime: '2018-12-10 12:00:00',
        bookingClasses: [
          { id: 'economy', availabilityCount: 100 },
          { id: 'business', availabilityCount: 20 },
        ],
      }, {
        id: 'IeKeix6G-2',
        departureDateTime: '2018-12-24 12:00:00',
        bookingClasses: [
          { id: 'economy', availabilityCount: 150 },
        ],
      }]);
      const flightsHash = InMemoryAdapter.storageInstance.create({
        updatedAt: '2019-01-01 12:00:00',
        items: [
          {
            id: 'IeKeix6G',
            origin: 'PRG',
            destination: 'LAX',
            segments: [
              {
                id: 'segment1',
                departureAirport: 'PRG',
                arrivalAirport: 'CDG',
              },
              {
                id: 'segment2',
                departureAirport: 'CDG',
                arrivalAirport: 'LAX',
              },
            ],
            flightInstancesUri: `in-memory://${flightInstancesHash}`,
          },
          {
            id: 'IeKeix7H',
            origin: 'LON',
            destination: 'CAP',
            segments: [
              {
                id: 'segment1',
                departureAirport: 'LON',
                arrivalAirport: 'CAP',
              },
            ],
            flightInstancesUri: `in-memory://${flightInstancesHash}`,
          },
        ],
      });
      const hash = InMemoryAdapter.storageInstance.create({
        flightsUri: `in-memory://${flightsHash}`,
      });
      const ptr = StoragePointer.createInstance(`in-memory://${hash}`, {
        flightsUri: { required: false, children: { items: { children: { flightInstancesUri: { required: false } } } } },
      });
      let data = await ptr.toPlainObject();
      assert.equal(data.contents.flightsUri.contents.items[0].id, 'IeKeix6G');
      assert.equal(data.contents.flightsUri.contents.items[0].origin, 'PRG');
      assert.equal(data.contents.flightsUri.contents.items[0].flightInstancesUri.contents[0].id, 'IeKeix6G-1');
      assert.equal(data.contents.flightsUri.contents.items[0].flightInstancesUri.contents[0].departureDateTime, '2018-12-10 12:00:00');
      assert.equal(data.contents.flightsUri.contents.items[0].flightInstancesUri.contents[1].id, 'IeKeix6G-2');
      assert.equal(data.contents.flightsUri.contents.items[0].flightInstancesUri.contents[1].departureDateTime, '2018-12-24 12:00:00');
      assert.equal(data.contents.flightsUri.contents.items[1].id, 'IeKeix7H');
      assert.equal(data.contents.flightsUri.contents.items[1].origin, 'LON');
      assert.equal(data.contents.flightsUri.contents.items[1].flightInstancesUri.contents[0].id, 'IeKeix6G-1');
      assert.equal(data.contents.flightsUri.contents.items[1].flightInstancesUri.contents[0].departureDateTime, '2018-12-10 12:00:00');
      assert.equal(data.contents.flightsUri.contents.items[1].flightInstancesUri.contents[1].id, 'IeKeix6G-2');
      assert.equal(data.contents.flightsUri.contents.items[1].flightInstancesUri.contents[1].departureDateTime, '2018-12-24 12:00:00');
    });

    it('should throw for nested pointer that contains an array', async () => {
      const hash = InMemoryAdapter.storageInstance.create({
        ten:
          { okey: [ 'dokey', 'foo' ] },
      });
      const ptr = StoragePointer.createInstance(`in-memory://${hash}`, {
        ten: { nested: true },
      });
      try {
        await ptr.toPlainObject();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /which does not appear to be of type string/i);
      }
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
      assert.equal(pojo.contents.ten.key3.contents.length, 3);
      assert.deepEqual(pojo.contents.ten.key4.contents.publisher, 'Random House');
      assert.equal(pojo.contents.ten.key4.contents.members.length, 3);
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
