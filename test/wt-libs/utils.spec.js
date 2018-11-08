import { assert } from 'chai';
import sinon from 'sinon';
import Utils from '../../src/utils';

describe('WTLibs.Utils', () => {
  let utils;

  beforeEach(() => {
    utils = Utils.createInstance(3, 'http://localhost:8545');
  });

  describe('isZeroAddress', () => {
    it('should behave as expected', () => {
      assert.equal(utils.isZeroAddress(), true);
      assert.equal(utils.isZeroAddress('0x0000000000000000000000000000000000000000'), true);
      assert.equal(utils.isZeroAddress('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA'), false);
      assert.equal(utils.isZeroAddress('random-address'), true);
    });
  });

  describe('applyGasCoefficient', () => {
    it('should apply gas coefficient', () => {
      const gas = utils.applyGasCoefficient(10);
      assert.equal(gas, 10 * utils.gasCoefficient);
    });

    it('should fallback to gas if no coefficient is specified', () => {
      const origCoeff = utils.gasCoefficient;
      utils.gasCoefficient = undefined;
      const gas = utils.applyGasCoefficient(10);
      assert.equal(gas, 10);
      utils.gasCoefficient = origCoeff;
    });
  });

  describe('checkAddressChecksum', () => {
    it('should return if the address is properly checksummed', () => {
      assert.equal(utils.checkAddressChecksum('0x8C2373842D5EA4Ce4Baf53f4175e5e42a364c59C'), true);
      assert.equal(utils.checkAddressChecksum('0x8c2373842d5ea4Ce4baf53f4175e5e42a364c59c'), false);
    });
  });

  describe('determineCurrentAddressNonce', () => {
    it('should return transaction count', async () => {
      sinon.stub(utils.web3Eth, 'getTransactionCount').returns(6);
      assert.equal(await utils.determineCurrentAddressNonce('0x8c2373842d5ea4ce4baf53f4175e5e42a364c59c'), 6);
      utils.web3Eth.getTransactionCount.restore();
    });
  });
});
