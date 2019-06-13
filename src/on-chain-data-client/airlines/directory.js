import OnChainAirline from './airline';

import { AirlineNotFoundError, AirlineNotInstantiableError, RecordNotFoundError, RecordNotInstantiableError } from '../errors';
import AbstractDirectory from '../directory';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * index wrapper. It provides methods for working with airline
 * contracts.
 */
class AirlineDirectory extends AbstractDirectory {
  /**
   * Returns a configured instance of AirlineDirectory
   * representing a Winding Tree index contract on a given `directoryAddress`.
   */
  static createInstance (indexAddress, web3Utils, web3Contracts) {
    const instance = new AirlineDirectory(indexAddress, web3Utils, web3Contracts);
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
    const index = await this._getDeployedDirectory();
    return parseInt(await index.methods.organizationsIndex(address).call(), 10);
  }

  async _getRecordsAddressListFactory () {
    const index = await this._getDeployedDirectory();
    return index.methods.getOrganizations().call();
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
    return this.addRecord(airlineData);
  }

  async createAndAdd(orgJsonUri) {
    this.create(orgJsonUri); // TODO
    return this.add(orgJsonUri); // TODO
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
    return this.updateRecord(airline);
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
    return this.removeRecord(airline);
  }

  // /**
  //  * Generates transaction data required for transferring a airline
  //  * ownership and more metadata required for successful mining of that
  //  * transactoin. Does not sign or send the transaction.
  //  *
  //  * @throws {InputDataError} When airline does not have an address.
  //  * @throws {InputDataError} When airline does not contain a owner property.
  //  * @throws {InputDataError} When the new owner address is the same as the old owner.
  //  * @throws {InputDataError} When the new owner address is not a valid address.
  //  * @throws {WTLibsError} When anything goes wrong during data preparation phase.
  //  */
  // async transferOwnership (airline: AirlineInterface, newOwner: string): Promise<PreparedTransactionMetadataInterface> {
  //   return this.transferOwnership(airline, newOwner);
  // }

  /**
   * Gets airline representation of a airline on a given address. If airline
   * on such address is not registered through this Winding Tree index
   * instance, the method throws immediately.
   *
   * @throws {AirlineNotFoundError} When airline does not exist.
   * @throws {AirlineNotInstantiableError} When the airline class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getOrganization (address) { // TODO change to/use organizationsIndex+organizations
    try {
      const record = await this.getRecord(address);
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

  // /**
  //  * Returns a list of all airlines. It will filter out
  //  * every airline that is inaccessible for any reason.
  //  *
  //  * Currently any inaccessible airline is silently ignored.
  //  * Subject to change.
  //  */
  // async getOrganizations (): Promise<Array<AirlineInterface>> {
  //   return this.getAllRecords();
  // }
}

export default AirlineDirectory;
