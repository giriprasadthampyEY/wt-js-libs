import Directory from './index';

// TODO drop this?

/**
 * An entry-point abstraction for interacting with <record>s.
 *
 * This should be extended by particular data types, such as hotels,
 * airlines, OTAs etc.
 */
export class DataModel {
  /**
   * Returns new and configured instance
   */
  constructor (options, web3Utils, web3Contracts) {
    this.options = options || {};
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this._wtDirectoryCache = {};
  }

  /**
   * Returns an Ethereum backed Winding Tree directory.
   */
  _directoryContractFactory (address) {
    return Directory.createInstance(address, this.web3Utils, this.web3Contracts);
  }

  /**
   * Returns a cached Ethereum backed Winding Tree directory. Caching is done based
   * on ethereum address.
   */
  getDirectory (address) {
    if (!this._wtDirectoryCache[address]) {
      this._wtDirectoryCache[address] = this._directoryContractFactory(address);
    }
    return this._wtDirectoryCache[address];
  }
}

export default DataModel;
