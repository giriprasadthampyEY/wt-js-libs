// @flow

import type { DataModelInterface } from '../../interfaces/base-interfaces';
import type { WTHotelIndexInterface } from '../../interfaces/hotel-interfaces';
import type { WTAirlineIndexInterface } from '../../interfaces/airline-interfaces';
import type { OnChainDataClientOptionsType } from '../index';

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

  _wtIndexCache: {[address: string]: WTHotelIndexInterface | WTAirlineIndexInterface};

  /**
   * Returns new and configured instance
   */
  constructor (options: OnChainDataClientOptionsType, web3Utils: Utils, web3Contracts: Contracts) {
    this.options = options || {};
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this._wtIndexCache = {};
  }

  /**
   * Returns an Ethereum backed Winding Tree index.
   */
  _indexContractFactory (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    throw Error('Not implemented. Should be called on a subclass instance.');
  }

  /**
   * Returns a cached Ethereum backed Winding Tree index. Caching is done based
   * on ethereum address.
   */
  getWindingTreeIndex (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    if (!this._wtIndexCache[address]) {
      this._wtIndexCache[address] = this._indexContractFactory(address);
    }
    return this._wtIndexCache[address];
  }
}

export default AbstractDataModel;
