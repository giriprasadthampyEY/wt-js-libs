import { assert } from 'chai';
import sinon from 'sinon';
import AirlineDataModel from '../../src/on-chain-data-client/airlines/data-model';
import HotelDataModel from '../../src/on-chain-data-client/hotels/data-model';

import OnChainDataClient from '../../src/on-chain-data-client';
import { OnChainDataRuntimeError } from '../../src/on-chain-data-client/errors';

describe('WTLibs.on-chain-data.OnChainDataClient', () => {
  describe('setup', () => {
    it('should save options and dataModels', () => {
      OnChainDataClient.setup({ opt1: 'value', gasMargin: 4 });
      assert.equal(OnChainDataClient.options.opt1, 'value');
      assert.equal(OnChainDataClient.options.gasMargin, 4);
      assert.isUndefined(OnChainDataClient.options.gasCoefficient);
      assert.isDefined(OnChainDataClient.dataModels);
    });

    it('should setup default gasCoefficient', () => {
      OnChainDataClient.setup({ opt1: 'value' });
      assert.isDefined(OnChainDataClient.options.gasCoefficient, 2);
    });

    it('should setup web3Utils', () => {
      OnChainDataClient.setup({ opt1: 'value', provider: 'http://localhost:8545' });
      assert.isDefined(OnChainDataClient.web3Utils);
      assert.equal(OnChainDataClient.web3Utils.gasModifiers.gasCoefficient, 2);
      assert.isUndefined(OnChainDataClient.web3Utils.gasModifiers.gasMargin);
      assert.equal(OnChainDataClient.web3Utils.provider, 'http://localhost:8545');
    });

    it('should setup web3Contracts', () => {
      OnChainDataClient.setup({ opt1: 'value', provider: 'http://localhost:8545' });
      assert.isDefined(OnChainDataClient.web3Contracts);
      assert.equal(OnChainDataClient.web3Contracts.provider, 'http://localhost:8545');
    });
  });

  describe('_reset', () => {
    it('should reset options and dataModels', () => {
      OnChainDataClient.setup({ opt1: 'value', provider: 'http://localhost:8545' });
      OnChainDataClient.getDataModel('hotels');
      assert.isDefined(OnChainDataClient.dataModels.hotels);
      assert.isDefined(OnChainDataClient.options.opt1);
      OnChainDataClient._reset();
      assert.isUndefined(OnChainDataClient.dataModels.hotels);
      assert.isUndefined(OnChainDataClient.options.opt1);
    });
  });

  describe('getDataModel', () => {
    let createHotelSpy, createAirlineSpy;

    beforeAll(() => {
      OnChainDataClient.setup({ provider: 'http://localhost:8545' });
      createHotelSpy = sinon.spy(HotelDataModel, 'createInstance');
      createAirlineSpy = sinon.spy(AirlineDataModel, 'createInstance');
    });

    afterEach(() => {
      createHotelSpy.resetHistory();
      createAirlineSpy.resetHistory();
    });

    it('should cache datamodel instances', () => {
      OnChainDataClient.getDataModel('hotels');
      assert.isDefined(OnChainDataClient.dataModels.hotels);
      assert.equal(createHotelSpy.callCount, 1);
      OnChainDataClient.getDataModel('hotels');
      assert.equal(createHotelSpy.callCount, 1);
    });

    it('should throw on unknown segment', () => {
      try {
        OnChainDataClient.getDataModel('random-segment');
        assert(false);
      } catch (e) {
        assert.match(e.message, /unknown segment/i);
        assert.instanceOf(e, OnChainDataRuntimeError);
      }
    });
    
    it('should return airline datamodel', () => {
      const model = OnChainDataClient.getDataModel('airlines');
      assert.isDefined(OnChainDataClient.dataModels.airlines);
      assert.instanceOf(model, AirlineDataModel);
    });

    it('should return hotel datamodel', () => {
      const model = OnChainDataClient.getDataModel('hotels');
      assert.isDefined(OnChainDataClient.dataModels.hotels);
      assert.instanceOf(model, HotelDataModel);
    });
  });
});
