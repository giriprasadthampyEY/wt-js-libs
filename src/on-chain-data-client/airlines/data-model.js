import { AbstractDataModel } from '../directory/data-model';
import AirlineDirectory from './directory';

/**
 * An entry-point abstraction for interacting with airlines.
 */
export class AirlineDataModel extends AbstractDataModel {
  /**
   * Creates a configured AirlineDataModel instance.
   */
  static createInstance (options, web3Utils, web3Contracts) {
    return new AirlineDataModel(options, web3Utils, web3Contracts);
  }

  _directoryContractFactory (address) {
    return AirlineDirectory.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export default AirlineDataModel;
