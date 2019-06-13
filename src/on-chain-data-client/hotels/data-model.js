import { AbstractDataModel } from '../directory/data-model';
import HotelDirectory from './directory';

/**
 * An entry-point abstraction for interacting with hotels.
 */
export class HotelDataModel extends AbstractDataModel {
  /**
   * Creates a configured HotelDataModel instance.
   */
  static createInstance (options, web3Utils, web3Contracts) {
    return new HotelDataModel(options, web3Utils, web3Contracts);
  }

  _directoryContractFactory (address) {
    return HotelDirectory.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export default HotelDataModel;
