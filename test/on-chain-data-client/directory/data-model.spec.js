import { assert } from 'chai';
import sinon from 'sinon';

import { AbstractDataModel } from '../../../src/on-chain-data-client/directory/data-model';
import AirlineDataModel from '../../../src/on-chain-data-client/airlines/data-model';
import AirlineDirectory from '../../../src/on-chain-data-client/airlines/directory';

describe('WTLibs.on-chain-data.directory.DataModel', () => {
  it('should throw when using abstract ancestor', () => {
    let dataModel = new AbstractDataModel();
    try {
      dataModel.getDirectory('0x0');
      assert(false);
    } catch (e) {
      assert.match(e.message, /Not implemented. Should be called on a subclass instance/i);
      assert.instanceOf(e, Error);
    }
  });

  it('should cache directory instances', () => {
    const dataModel = AirlineDataModel.createInstance({ provider: 'http://localhost:8545' }, {}, {});
    const createInstanceSpy = sinon.spy(AirlineDirectory, 'createInstance');
    assert.equal(createInstanceSpy.callCount, 0);
    dataModel.getDirectory('address1');
    assert.equal(createInstanceSpy.callCount, 1);
    dataModel.getDirectory('address1');
    assert.equal(createInstanceSpy.callCount, 1);
    dataModel.getDirectory('address2');
    assert.equal(createInstanceSpy.callCount, 2);
    createInstanceSpy.restore();
  });
});
