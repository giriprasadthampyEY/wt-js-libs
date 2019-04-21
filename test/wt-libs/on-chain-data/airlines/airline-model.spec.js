import { assert } from 'chai';
import sinon from 'sinon';
import { AirlineDataModel } from '../../../../src/on-chain-data/index';
import WTAirlineIndex from '../../../../src/on-chain-data/airlines/wt-index';
import testedDataModel from '../../../utils/data-airline-model-definition';

describe('WTLibs.on-chain-data.AirlineDataModel', () => {
  it('should cache WTIndex instances', () => {
    const dataModel = AirlineDataModel.createInstance(testedDataModel.withDataSource().dataModelOptions);
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
