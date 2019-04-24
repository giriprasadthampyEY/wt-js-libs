// @flow

import type { DataModelOptionsType } from '../abstract-data-model';

import { AbstractDataModel } from '../abstract-data-model';
import Utils from '../utils';
import Contracts from '../contracts';
import WTAirlineIndex from './wt-index';

export class AirlineDataModel extends AbstractDataModel {
  /**
   * Creates a configured AirlineDataModel instance.
   */
  static createInstance (options: DataModelOptionsType, web3Utils: Utils, web3Contracts: Contracts): AbstractDataModel {
    return new AirlineDataModel(options, web3Utils, web3Contracts);
  }

  _indexFactory (address: string): WTAirlineIndex {
    return WTAirlineIndex.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export default AirlineDataModel;
