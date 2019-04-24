// @flow

import type { DataModelInterface } from '../interfaces/base-interfaces';
import type { WTHotelIndexInterface } from '../interfaces/hotel-interfaces';
import type { WTAirlineIndexInterface } from '../interfaces/airline-interfaces';
import type { OnChainDataClientOptionsType } from './index';

import Utils from './utils';
import Contracts from './contracts';

/**
 * AbstractDataModel
 */
export class AbstractDataModel implements DataModelInterface {
  options: OnChainDataClientOptionsType;
  web3Utils: Utils;
  web3Contracts: Contracts;

  _wtIndexCache: {[address: string]: WTHotelIndexInterface | WTAirlineIndexInterface};

  /**
   * Sets up Utils and Contracts with given web3 provider.
   * Sets up gasCoefficient or gasMargin. If neither is provided,
   * sets gasCoefficient to a default of 2.
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
