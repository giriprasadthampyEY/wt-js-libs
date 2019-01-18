import { assert } from 'chai';
import { AbstractDataModel } from '../../../src/data-model/index';

describe('WTLibs.data-model.AirlineDataModel', () => {
  it('should throw when using abstract ancestor', () => {
    let dataModel = new AbstractDataModel();
    try {
      dataModel.getWindingTreeIndex('0x0');
      throw new Error('should not have been called');
    } catch (e) {
      assert.match(e.message, /Not implemented. Should be called on a subclass instance/i);
      assert.instanceOf(e, Error);
    }
  });
});
