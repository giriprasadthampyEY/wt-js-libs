// @flow

import type { OnChainDataClientOptionsType } from '../index';

import { AbstractDataModel } from '../directory/data-model';
import Utils from '../utils';
import Contracts from '../contracts';
import AirlineDirectory from './directory';

/**
 * An entry-point abstraction for interacting with airlines.
 */
export class AirlineDataModel extends AbstractDataModel {
  /**
   * Creates a configured AirlineDataModel instance.
   */
  static createInstance (options: OnChainDataClientOptionsType, web3Utils: Utils, web3Contracts: Contracts): AbstractDataModel {
    return new AirlineDataModel(options, web3Utils, web3Contracts);
  }

  _directoryContractFactory (address: string): AirlineDirectory {
    return AirlineDirectory.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export default AirlineDataModel;
