// @flow

import type { DataModelInterface } from '../interfaces/base-interfaces';
import type { WTHotelIndexInterface } from '../interfaces/hotel-interfaces';
import type { WTAirlineIndexInterface } from '../interfaces/airline-interfaces';

import Utils from './utils';
import Contracts from './contracts';

/**
 * DataModelOptionsType options. May look like this:
 *
 * ```
 * {
 *   "provider": 'http://localhost:8545',// or another Web3 provider
 *   "gasCoefficient": 2 // Optional, defaults to 2
 * }
 * ```
 */
export type DataModelOptionsType = {
  // URL of currently used RPC provider for Web3.
  provider: string | Object,
  // Gas coefficient that is used as a multiplier when setting
  // a transaction gas.
  gasCoefficient?: number,
  // Gas margin that is added to a computed gas amount when
  // setting a transaction gas.
  gasMargin?: number
};

/**
 * AbstractDataModel
 */
export class AbstractDataModel implements DataModelInterface {
  options: DataModelOptionsType;
  web3Utils: Utils;
  web3Contracts: Contracts;

  _wtIndexCache: {[address: string]: WTHotelIndexInterface | WTAirlineIndexInterface};

  /**
   * Sets up Utils and Contracts with given web3 provider.
   * Sets up gasCoefficient or gasMargin. If neither is provided,
   * sets gasCoefficient to a default of 2.
   */
  constructor (options: DataModelOptionsType, web3Utils: Utils, web3Contracts: Contracts) {
    this.options = options || {};
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this._wtIndexCache = {};
  }

  /**
   * Returns an Ethereum backed Winding Tree index.
   */
  _indexFactory (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    throw Error('Not implemented. Should be called on a subclass instance.');
  }

  /**
   * Returns an Ethereum backed Winding Tree index.
   */
  getWindingTreeIndex (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    if (!this._wtIndexCache[address]) {
      this._wtIndexCache[address] = this._indexFactory(address);
    }
    return this._wtIndexCache[address];
  }
}

export default AbstractDataModel;
