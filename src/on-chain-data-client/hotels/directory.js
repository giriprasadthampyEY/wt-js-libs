import OnChainHotel from './hotel';

import {
  HotelNotFoundError,
  HotelNotInstantiableError,
  RecordNotFoundError,
  RecordNotInstantiableError,
} from '../errors';
import AbstractDirectory from '../directory';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * directory wrapper. It provides methods for working with hotel
 * contracts.
 */
class HotelDirectory extends AbstractDirectory {
  /**
   * Returns a configured instance of HotelDirectory
   * representing a Winding Tree directory contract on a given `directoryAddress`.
   */
  static createInstance (directoryAddress, web3Utils, web3Contracts) {
    const instance = new HotelDirectory(directoryAddress, web3Utils, web3Contracts);
    instance.RECORD_TYPE = 'hotel';
    return instance;
  }

  async _getDeployedDirectoryFactory () {
    return this.web3Contracts.getHotelDirectoryInstance(this.address);
  }

  async _createRecordInstanceFactory (address) {
    return OnChainHotel.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedDirectory(), address);
  }

  async _getDirectoryRecordPositionFactory (address) {
    const directory = await this._getDeployedDirectory();
    return parseInt(await directory.methods.organizationsIndex(address).call(), 10);
  }

  async _getDirectoryRecordByPositionFactory (idx) {
    const directory = await this._getDeployedDirectory();
    return directory.methods.organizations(idx).call();
  }

  async _getRecordsAddressListFactory () {
    const directory = await this._getDeployedDirectory();
    return directory.methods.getOrganizations().call();
  }

  async _getSegmentFactory (transactionOptions) {
    const directory = await this._getDeployedDirectory();
    return directory.methods.getSegment().call(transactionOptions);
  }

  async getSegment (transactionOptions) {
    return this._getSegment(transactionOptions);
  }

  /**
   * Generates transaction data required for adding a totally new hotel
   * and more metadata required for sucessful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When hotelData does not contain orgJsonUri property.
   * @throws {InputDataError} When hotelData does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async add (hotelData) {
    return this._addRecord(hotelData);
  }

  async create (hotelData) {
    return this._createRecord(hotelData, false);
  }

  async createAndAdd (hotelData) {
    return this._createRecord(hotelData, true);
  }

  /**
   * Generates a list of transaction data required for updating a hotel
   * and more metadata required for sucessful mining of those transactions.
   * Does not sign or send any of the transactions.
   *
   * @throws {InputDataError} When hotel does not have a owner field.
   * @throws {InputDataError} When hotel does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async update (hotel) {
    return this._updateRecord(hotel);
  }

  /**
   * Generates transaction data required for removing a hotel
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When hotel does not contain orgJsonUri property.
   * @throws {InputDataError} When hotel does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async remove (hotel) {
    return this._removeRecord(hotel);
  }

  /**
   * Gets hotel representation of a hotel on a given address. If hotel
   * on such address is not registered through this Winding Tree directory
   * instance, the method throws immediately.
   *
   * @throws {HotelNotFoundError} When hotel does not exist.
   * @throws {HotelNotInstantiableError} When the hotel class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getRecord (address) {
    try {
      const record = await this._getRecord(address);
      return record;
    } catch (e) {
      if (e instanceof RecordNotFoundError) {
        throw new HotelNotFoundError(e);
      }
      if (e instanceof RecordNotInstantiableError) {
        throw new HotelNotInstantiableError(e);
      }
      throw e;
    }
  }

  /**
   * Returns a list of all hotels. It will filter out
   * every hotel that is inaccessible for any reason.
   *
   * Currently any inaccessible hotel is silently ignored.
   * Subject to change.
   */
  async getRecords () {
    return this._getRecords();
  }

  // TODO error handling
  async getRecordIndex (address) {
    return this._getRecordIndex(address);
  }

  async getRecordByIndex (idx) {
    return this._getRecordByIndex(idx);
  }
}

export default HotelDirectory;
