import { assert } from 'chai';
import sinon from 'sinon';
import { AbstractDataModel } from '../../src/on-chain-data-client/abstract-data-model';
import { AirlineDataModel } from '../../src/on-chain-data-client/airlines/data-model';
import WTAirlineIndex from '../../src/on-chain-data-client/airlines/wt-index';
import testedDataModel from '../utils/data-airline-model-definition';

describe('WTLibs.on-chain-data.DataModel', () => {
  it('should throw when using abstract ancestor', () => {
    let dataModel = new AbstractDataModel();
    try {
      dataModel.getWindingTreeIndex('0x0');
      assert(false);
    } catch (e) {
      assert.match(e.message, /Not implemented. Should be called on a subclass instance/i);
      assert.instanceOf(e, Error);
    }
  });

  it('should cache WTIndex instances', () => {
    const dataModel = AirlineDataModel.createInstance(testedDataModel.withDataSource().onChainDataOptions, {}, {});
    const createInstanceSpy = sinon.spy(WTAirlineIndex, 'createInstance');
    assert.equal(createInstanceSpy.callCount, 0);
    dataModel.getWindingTreeIndex('address1');
    assert.equal(createInstanceSpy.callCount, 1);
    dataModel.getWindingTreeIndex('address1');
    assert.equal(createInstanceSpy.callCount, 1);
    dataModel.getWindingTreeIndex('address2');
    assert.equal(createInstanceSpy.callCount, 2);
    createInstanceSpy.restore();
  });
});
