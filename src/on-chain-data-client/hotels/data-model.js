// @flow

import type { OnChainDataClientOptionsType } from '../index';

import { AbstractDataModel } from '../wt-index/data-model';
import Utils from '../utils';
import Contracts from '../contracts';
import WTHotelIndex from './wt-index';

/**
 * An entry-point abstraction for interacting with hotels.
 */
export class HotelDataModel extends AbstractDataModel {
  /**
   * Creates a configured HotelDataModel instance.
   */
  static createInstance (options: OnChainDataClientOptionsType, web3Utils: Utils, web3Contracts: Contracts): AbstractDataModel {
    return new HotelDataModel(options, web3Utils, web3Contracts);
  }

  _indexFactory (address: string): WTHotelIndex {
    return WTHotelIndex.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export default HotelDataModel;
