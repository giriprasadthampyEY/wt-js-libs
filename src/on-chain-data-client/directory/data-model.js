// @flow

import type { DataModelInterface } from '../../interfaces/base-interfaces';
import type { HotelDirectoryInterface } from '../../interfaces/hotel-interfaces';
import type { AirlineDirectoryInterface } from '../../interfaces/airline-interfaces';
import type { OnChainDataClientOptionsType } from '../directory';

import Utils from '../utils';
import Contracts from '../contracts';

/**
 * An entry-point abstraction for interacting with <record>s.
 *
 * This should be extended by particular data types, such as hotels,
 * airlines, OTAs etc.
 */
export class AbstractDataModel implements DataModelInterface {
  options: OnChainDataClientOptionsType;
  web3Utils: Utils;
  web3Contracts: Contracts;

  _wtDirectoryCache: {[address: string]: HotelDirectoryInterface | AirlineDirectoryInterface};

  /**
   * Returns new and configured instance
   */
  constructor (options: OnChainDataClientOptionsType, web3Utils: Utils, web3Contracts: Contracts) {
    this.options = options || {};
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this._wtDirectoryCache = {};
  }

  /**
   * Returns an Ethereum backed Winding Tree directory.
   */
  _directoryContractFactory (address: string): HotelDirectoryInterface | AirlineDirectoryInterface {
    throw Error('Not implemented. Should be called on a subclass instance.');
  }

  /**
   * Returns a cached Ethereum backed Winding Tree directory. Caching is done based
   * on ethereum address.
   */
  getDirectory (address: string): HotelDirectoryInterface | AirlineDirectoryInterface {
    if (!this._wtDirectoryCache[address]) {
      this._wtDirectoryCache[address] = this._directoryContractFactory(address);
    }
    return this._wtDirectoryCache[address];
  }
}

export default AbstractDataModel;
