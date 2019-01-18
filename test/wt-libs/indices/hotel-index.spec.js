import { assert } from 'chai';
import sinon from 'sinon';
import WTLibs from '../../../src/index';
import { HotelDataModel } from '../../../src/data-model';
import OffChainDataClient from '../../../src/off-chain-data-client';
import { HOTEL_SEGMENT_ID } from '../../../src/constants';

describe('WTLibs.WTHotelIndex', () => {
  describe('createInstance', () => {
    let createDataModelSpy;

    beforeEach(() => {
      createDataModelSpy = sinon.spy(HotelDataModel, 'createInstance');
    });

    afterEach(() => {
      createDataModelSpy.restore();
    });

    it('should initialize data model', () => {
      const libs = WTLibs.createInstance({ segment: HOTEL_SEGMENT_ID });
      assert.isDefined(libs.dataModel);
      assert.equal(createDataModelSpy.callCount, 1);
    });

    it('should pass data model options', () => {
      const libs = WTLibs.createInstance({
        segment: HOTEL_SEGMENT_ID,
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
        segment: HOTEL_SEGMENT_ID,
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
