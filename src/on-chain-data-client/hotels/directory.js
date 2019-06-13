// @flow
import type {
  HotelDirectoryInterface,
  HotelInterface,
  PreparedTransactionMetadataInterface
} from '../../interfaces/hotel-interfaces';
import Utils from '../utils';
import Contracts from '../contracts';
import OnChainHotel from './hotel';

import {
  HotelNotFoundError,
  HotelNotInstantiableError,
  RecordNotFoundError,
  RecordNotInstantiableError
} from '../errors';
import AbstractDirectory from '../directory';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * directory wrapper. It provides methods for working with hotel
 * contracts.
 */
class HotelDirectory extends AbstractDirectory implements HotelDirectoryInterface {
  /**
   * Returns a configured instance of HotelDirectory
   * representing a Winding Tree directory contract on a given `directoryAddress`.
   */
  static createInstance (directoryAddress: string, web3Utils: Utils, web3Contracts: Contracts): HotelDirectory {
    const instance = new HotelDirectory(directoryAddress, web3Utils, web3Contracts);
    instance.RECORD_TYPE = 'hotel';
    return instance;
  }

  async _getDeployedDirectoryFactory (): Promise<Object> {
    return this.web3Contracts.getHotelDirectoryInstance(this.address);
  }

  async _createRecordInDirectoryFactory (orgJsonUri?: string): Promise<Object> {
    const directory = await this._getDeployedDirectory();
    return directory.methods.create(orgJsonUri).call();
  }

  async _createRecordInstanceFactory (address?: string): Promise<Object> {
    return OnChainHotel.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedDirectory(), address);
  }

  async _createAndAddRecordInstanceFactory (address?: string): Promise<Object> {
    return OnChainHotel.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedDirectory(), address);
  }

  async _getDirectoryRecordPositionFactory (address: string): Promise<number> {
    const directory = await this._getDeployedDirectory();
    return parseInt(await directory.methods.organizationsIndex(address).call(), 10);
  }

  async _getRecordsAddressListFactory (): Promise<Array<string>> {
    const directory = await this._getDeployedDirectory();
    return directory.methods.getOrganizations().call();
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
  async add (hotelData: HotelInterface): Promise<PreparedTransactionMetadataInterface> {
    return this.addRecord(hotelData);
  }

  async create(hotelData: HotelInterface, alsoAdd: boolean = false): Process<PreparedTransactionMetadataInterface> {
    return this.createRecord(hotelData, alsoAdd);
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
  async update (hotel: HotelInterface): Promise<Array<PreparedTransactionMetadataInterface>> {
    return this.updateRecord(hotel);
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
  async remove (hotel: HotelInterface, transactionOptions): Promise<PreparedTransactionMetadataInterface> {
    return this.removeRecord(hotel);
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
  async getOrganization (address: string): Promise<?HotelInterface> { // TODO change to/use organizationsIndex+organizations
    try {
      const record = await this.getRecord(address);
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
  async getOrganizations (): Promise<Array<HotelInterface>> {
    return this.getAllRecords();
  }
}

export default HotelDirectory;
