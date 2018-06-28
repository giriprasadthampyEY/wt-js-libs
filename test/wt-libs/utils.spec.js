import { assert } from 'chai';
import sinon from 'sinon';
import Utils from '../../src/utils';
import Web3 from 'web3';

describe('WTLibs.Utils', () => {
  let utils;

  beforeEach(() => {
    utils = Utils.createInstance(3, new Web3('http://localhost:8545'));
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

  describe('getCurrentWeb3Provider', () => {
    it('should return current web3 provider', () => {
      assert.equal(utils.getCurrentWeb3Provider().host, 'http://localhost:8545');
    });
  });

  describe('determineDeployedContractFutureAddress', () => {
    it('should compute proper address', () => {
      const expectedAddress = '0x0C4c734F0Ecb92270D1ebE7b04aEC4440EB05CAa';
      assert.equal(utils.determineDeployedContractFutureAddress('0x8c2373842d5ea4ce4baf53f4175e5e42a364c59c', 3), expectedAddress);
    });
  });

  describe('determineCurrentAddressNonce', () => {
    it('should return transaction count', async () => {
      sinon.stub(utils.web3.eth, 'getTransactionCount').returns(6);
      assert.equal(await utils.determineCurrentAddressNonce('0x8c2373842d5ea4ce4baf53f4175e5e42a364c59c'), 6);
      utils.web3.eth.getTransactionCount.restore();
    });
  });
});
