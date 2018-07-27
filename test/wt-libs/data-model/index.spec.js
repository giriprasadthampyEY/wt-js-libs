import { assert } from 'chai';
import sinon from 'sinon';
import Web3UriDataModel from '../../../src/data-model/';
import WTIndexDataProvider from '../../../src/data-model/wt-index';
import testedDataModel from '../../utils/data-model-definition';

describe('WTLibs.data-model', () => {
  it('should cache WTIndex instances', () => {
    const dataModel = Web3UriDataModel.createInstance(testedDataModel.withDataSource().dataModelOptions);
    const createInstanceSpy = sinon.spy(WTIndexDataProvider, 'createInstance');
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
