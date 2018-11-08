// @flow

import type { TxReceiptInterface, TxInterface } from './interfaces';
import Web3Eth from 'web3-eth';
import Web3Utils from 'web3-utils';

/**
 * Collection of utility methods useful during
 * communication with Ethereum network.
 */
class Utils {
  gasCoefficient: number;
  provider: string | Object;
  web3Eth: Web3Eth;

  /**
   * Returns an initialized instance
   *
   * @parameters {number} gasCoefficient is a constant that can be applied to any
   * ethereum transaction to ensure it will be mined.
   * @param  {number} gasCoefficient which is applied to every transaction
   * @param  {string|Object} web3 instance provider used to create web3-eth
   * @return {Utils}
   */
  static createInstance (gasCoefficient: number, provider: string | Object): Utils {
    return new Utils(gasCoefficient, provider);
  }

  constructor (gasCoefficient: number, provider: string | Object) {
    this.gasCoefficient = gasCoefficient;
    this.provider = provider;
    this.web3Eth = new Web3Eth(provider);
  }

  /**
   * Is address a zero address? Uses a string comparison.
   * Returns true also for strings that are not a valid address.
   *
   * @return {boolean}
   */
  isZeroAddress (address: string): boolean {
    if (!address || !Web3Utils.isAddress(address)) {
      return true;
    }
    return String(address) === '0x0000000000000000000000000000000000000000';
  }

  /**
   * Multiplies the gas with a previously configured `gasCoefficient`
   * @param {number} gas
   * @return {number}
   */
  applyGasCoefficient (gas: number): number {
    if (this.gasCoefficient) {
      return Math.ceil(gas * this.gasCoefficient);
    }
    return gas;
  }

  /**
   * Proxy method for `web3.eth.getBlockNumber`
   */
  async getCurrentBlockNumber (): Promise<number> {
    return this.web3Eth.getBlockNumber();
  }

  /**
   * Proxy method for `web3.eth.checkAddressChecksum`
   */
  checkAddressChecksum (address: string): boolean {
    return Web3Utils.checkAddressChecksum(address);
  }

  /**
   * Returns current number of transactions mined for given
   * Ethereum address
   *
   * @param {string} address
   * @return number
   */
  async determineCurrentAddressNonce (address: string): Promise<number> {
    return this.web3Eth.getTransactionCount(address);
  }

  /**
   * Proxy method for `web3.eth.getTransactionReceipt`
   *
   * @param {string} txHash
   * @return {TxReceiptInterface}
   */
  async getTransactionReceipt (txHash: string): Promise<TxReceiptInterface> {
    return this.web3Eth.getTransactionReceipt(txHash);
  }

  /**
   * Proxy method for `web3.eth.getTransaction`
   */
  async getTransaction (txHash: string): Promise<TxInterface> {
    return this.web3Eth.getTransaction(txHash);
  }
}

export default Utils;
