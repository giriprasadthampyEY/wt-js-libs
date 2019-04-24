// @flow

import type { DataModelOptionsType } from '../abstract-data-model';

import { AbstractDataModel } from '../abstract-data-model';
import Utils from '../utils';
import Contracts from '../contracts';
import WTHotelIndex from './wt-index';

export class HotelDataModel extends AbstractDataModel {
  /**
   * Creates a configured HotelDataModel instance.
   */
  static createInstance (options: DataModelOptionsType, web3Utils: Utils, web3Contracts: Contracts): AbstractDataModel {
    return new HotelDataModel(options, web3Utils, web3Contracts);
  }

  _indexFactory (address: string): WTHotelIndex {
    return WTHotelIndex.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export default HotelDataModel;
