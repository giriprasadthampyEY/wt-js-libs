import { assert } from 'chai';
import sinon from 'sinon';
import { AirlineDataModel } from '../../../../src/data-model/index';
import WTAirlineIndex from '../../../../src/data-model/wt-airline-index';
import testedDataModel from '../../../utils/data-airline-model-definition';

describe('WTLibs.data-model.AirlineDataModel', () => {
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
