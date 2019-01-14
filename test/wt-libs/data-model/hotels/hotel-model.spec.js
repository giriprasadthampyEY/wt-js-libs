import { assert } from 'chai';
import sinon from 'sinon';
import { HotelDataModel } from '../../../../src/data-model/index';
import WTHotelIndex from '../../../../src/data-model/wt-hotel-index';
import testedDataModel from '../../../utils/data-hotel-model-definition';

describe('WTLibs.data-model.HotelDataModel', () => {
  it('should cache WTIndex instances', () => {
    const dataModel = HotelDataModel.createInstance(testedDataModel.withDataSource().dataModelOptions);
    const createInstanceSpy = sinon.spy(WTHotelIndex, 'createInstance');
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
