import OnChainAirline from './airline';

import {
  AirlineNotFoundError,
  AirlineNotInstantiableError,
  RecordNotFoundError,
  RecordNotInstantiableError
} from '../errors';
import AbstractDirectory from '../directory';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * directory wrapper. It provides methods for working with airline
 * contracts.
 */
class AirlineDirectory extends AbstractDirectory {
  /**
   * Returns a configured instance of AirlineDirectory
   * representing a Winding Tree directory contract on a given `directoryAddress`.
   */
  static createInstance (directoryAddress, web3Utils, web3Contracts) {
    const instance = new AirlineDirectory(directoryAddress, web3Utils, web3Contracts);
    instance.RECORD_TYPE = 'airline';
    return instance;
  }

  async _getDeployedDirectoryFactory () {
    return this.web3Contracts.getAirlineDirectoryInstance(this.address);
  }

  async _createRecordInstanceFactory (address) {
    return OnChainAirline.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedDirectory(), address);
  }

  async _getDirectoryRecordPositionFactory (address) {
    const directory = await this._getDeployedDirectory();
    return parseInt(await directory.methods.organizationsIndex(address).call(), 10);
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
   * Generates transaction data required for adding a totally new airline
   * and more metadata required for sucessful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When airlineData does not contain orgJsonUri property.
   * @throws {InputDataError} When airlineData does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async add (airlineData) {
    return this._addRecord(airlineData);
  }

  async create(airlineData) {
    return this._createRecord(airlineData, false);
  }

  async createAndAdd(airlineData) {
    return this._createRecord(airlineData, true);
  }

  /**
   * Generates a list of transaction data required for updating a airline
   * and more metadata required for sucessful mining of those transactions.
   * Does not sign or send any of the transactions.
   *
   * @throws {InputDataError} When airline does not have a owner field.
   * @throws {InputDataError} When airline does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async update (airline) {
    return this._updateRecord(airline);
  }

  /**
   * Generates transaction data required for removing a airline
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When airline does not contain orgJsonUri property.
   * @throws {InputDataError} When airline does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async remove (airline) {
    return this._removeRecord(airline);
  }

  /**
   * Gets airline representation of a airline on a given address. If airline
   * on such address is not registered through this Winding Tree directory
   * instance, the method throws immediately.
   *
   * @throws {AirlineNotFoundError} When airline does not exist.
   * @throws {AirlineNotInstantiableError} When the airline class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getRecord (address) {
    try {
      const record = await this._getRecord(address);
      return record;
    } catch (e) {
      if (e instanceof RecordNotFoundError) {
        throw new AirlineNotFoundError(e);
      }
      if (e instanceof RecordNotInstantiableError) {
        throw new AirlineNotInstantiableError(e);
      }
      throw e;
    }
  }

  /**
   * Returns a list of all airlines. It will filter out
   * every airline that is inaccessible for any reason.
   *
   * Currently any inaccessible airline is silently ignored.
   * Subject to change.
   */
  async getRecords () {
    return this._getRecords();
  }
}

export default AirlineDirectory;
