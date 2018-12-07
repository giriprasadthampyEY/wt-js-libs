// @flow

import type { TxReceiptInterface, TxInterface } from './interfaces';
import Web3Eth from 'web3-eth';
import Web3Utils from 'web3-utils';

export type GasModifiersType = {
  // Gas coefficient that is used as a multiplier when setting
  // a transaction gas.
  gasCoefficient?: number,
  // Gas margin that is added to a computed gas amount when
  // setting a transaction gas.
  gasMargin?: number
};

/**
 * Collection of utility methods useful during
 * communication with Ethereum network.
 */
class Utils {
  gasModifiers: GasModifiersType;
  provider: string | Object;
  web3Eth: Web3Eth;

  /**
   * Returns an initialized instance
   *
   * @param  {GasModifiersType} gasCoefficient or gasMargin that can be applied
   * to outgoing transactions.
   * @param  {string|Object} web3 instance provider used to create web3-eth
   * @return {Utils}
   */
  static createInstance (gasModifiers: GasModifiersType, provider: string | Object): Utils {
    return new Utils(gasModifiers, provider);
  }

  constructor (gasModifiers: GasModifiersType, provider: string | Object) {
    this.gasModifiers = gasModifiers;
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
   * Modifies the gas with a previously configured `gasCoefficient`
   * or `gasMargin`.
   * @param {number} gas
   * @return {number} modified gas
   */
  applyGasModifier (gas: number): number {
    if (this.gasModifiers) {
      if (this.gasModifiers.gasMargin) {
        return Math.ceil(gas + this.gasModifiers.gasMargin);
      } else if (this.gasModifiers.gasCoefficient) {
        return Math.ceil(gas * this.gasModifiers.gasCoefficient);
      }
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
