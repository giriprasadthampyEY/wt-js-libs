import { assert } from 'chai';
import sinon from 'sinon';
import { HotelDataModel } from '../../../../src/on-chain-data/index';
import WTHotelIndex from '../../../../src/on-chain-data/hotels/wt-index';
import testedDataModel from '../../../utils/data-hotel-model-definition';

describe('WTLibs.on-chain-data.HotelDataModel', () => {
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
