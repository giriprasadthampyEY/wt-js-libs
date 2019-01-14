import { assert } from 'chai';
import sinon from 'sinon';
import WTLibs from '../../../src/index';
import { AirlineDataModel } from '../../../src/data-model';
import OffChainDataClient from '../../../src/off-chain-data-client';

describe('WTLibs.WTAirlineIndex', () => {
  describe('createInstance', () => {
    let createDataModelSpy;

    beforeEach(() => {
      createDataModelSpy = sinon.spy(AirlineDataModel, 'createInstance');
    });

    afterEach(() => {
      createDataModelSpy.restore();
    });

    it('should initialize data model', () => {
      const libs = WTLibs.createInstance({ segment: 'airlines' });
      assert.isDefined(libs.dataModel);
      assert.equal(createDataModelSpy.callCount, 1);
    });

    it('should pass data model options', () => {
      const libs = WTLibs.createInstance({
        segment: 'airlines',
        dataModelOptions: {
          random: '1234',
        },
      });
      assert.isDefined(libs.dataModel);
      assert.equal(createDataModelSpy.firstCall.args[0].random, '1234');
    });
  });

  describe('getOffChainDataClient', () => {
    it('should return OffChainDataClient', () => {
      const libs = WTLibs.createInstance({
        segment: 'airlines',
        dataModelOptions: {
          random: '1234',
        },
        offChainDataOptions: {
          adapters: {
            'in-memory': {
              create: () => {
                return true;
              },
            },
          },
        },
      });
      const adapter = libs.getOffChainDataClient('in-memory');
      assert.isDefined(adapter);
      OffChainDataClient._reset();
    });
  });
});
