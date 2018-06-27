// @flow

import type { TxReceiptInterface, TxInterface } from './interfaces';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
import ethJsUtil from 'ethereumjs-util';

/**
 * Collection of utility methods useful during
 * communication with Ethereum network.
 */
class Utils {
  gasCoefficient: number;
  web3: Web3;

  /**
   * Returns an initialized instance
   * @parameters {number} gasCoefficient is a constant that can be applied to any
   * ethereum transaction to ensure it will be mined.
   * @param  {Web3} web3 instance created by `new Web3(provider)`
   * @return {Contracts}
   */
  static createInstance (gasCoefficient: number, web3: Web3): Utils {
    return new Utils(gasCoefficient, web3);
  }

  constructor (gasCoefficient: number, web3: Web3) {
    this.gasCoefficient = gasCoefficient;
    this.web3 = web3;
  }

  /**
   * Is address a zero address? Uses a bignumber.js test
   *
   * @return {boolean}
   */
  isZeroAddress (address: string): boolean {
    if (!address || !this.web3.utils.isAddress(address)) {
      return true;
    }
    const addrAsBn = new BigNumber(address);
    return addrAsBn.isZero();
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
   * Determines the future address of a deployed contact if such
   * contact is deployed in a transaction originating from `sender`
   * with `nonce`. Uses `ethereumjs-util` implementation
   * and always returns a checksum formatted Ethereum address.
   *
   * @param {string} sender
   * @param {number} nonce
   * @type {string} Resulting address
   */
  determineDeployedContractFutureAddress (sender: string, nonce: number): string {
    // web3js stores checksummed addresses by default
    // (@see https://github.com/ethereum/EIPs/blob/master/EIPS/eip-55.md)
    return ethJsUtil.toChecksumAddress(ethJsUtil.bufferToHex(ethJsUtil.generateAddress(
      sender,
      nonce
    )));
  }

  /**
   * Proxy method for `web3.currentProvider`
   */
  getCurrentWeb3Provider (): Object {
    return this.web3.currentProvider;
  }

  /**
   * Proxy method for `web3.eth.getBlockNumber`
   */
  async getCurrentBlockNumber (): Promise<number> {
    return this.web3.eth.getBlockNumber();
  }

  /**
   * Returns current number of transactions mined for given
   * Ethereum address
   *
   * @param {string} address
   * @return number
   */
  async determineCurrentAddressNonce (address: string): Promise<number> {
    return this.web3.eth.getTransactionCount(address);
  }

  /**
   * Proxy method for `web3.eth.getTransactionReceipt`
   *
   * @param {string} txHash
   * @return {TxReceiptInterface}
   */
  async getTransactionReceipt (txHash: string): Promise<TxReceiptInterface> {
    return this.web3.eth.getTransactionReceipt(txHash);
  }

  /**
   * Proxy method for `web3.eth.getTransaction`
   */
  async getTransaction (txHash: string): Promise<TxInterface> {
    return this.web3.eth.getTransaction(txHash);
  }
}

export default Utils;
