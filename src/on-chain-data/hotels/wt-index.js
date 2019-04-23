// @flow
import type { WTHotelIndexInterface, HotelInterface, PreparedTransactionMetadataInterface } from '../../interfaces/hotel-interfaces';
import Utils from '../utils';
import Contracts from '../contracts';
import OnChainHotel from './hotel';

import { HotelNotFoundError, HotelNotInstantiableError, RecordNotFoundError, RecordNotInstantiableError } from '../errors';
import AbstractWTIndex from '../wt-index';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * index wrapper. It provides methods for working with hotel
 * contracts.
 */
class WTHotelIndex extends AbstractWTIndex implements WTHotelIndexInterface {
  /**
   * Returns a configured instance of WTHotelIndex
   * representing a Winding Tree index contract on a given `indexAddress`.
   */
  static createInstance (indexAddress: string, web3Utils: Utils, web3Contracts: Contracts): WTHotelIndex {
    const instance = new WTHotelIndex(indexAddress, web3Utils, web3Contracts);
    instance.RECORD_TYPE = 'hotel';
    return instance;
  }

  async _getDeployedIndexFactory (): Promise<Object> {
    return this.web3Contracts.getHotelIndexInstance(this.address);
  }

  async _createRecordInstanceFactory (address?: string): Promise<Object> {
    return OnChainHotel.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedIndex(), address);
  }

  async _getIndexRecordPositionFactory (address: string): Promise<number> {
    const index = await this._getDeployedIndex();
    return parseInt(await index.methods.hotelsIndex(address).call(), 10);
  }

  async _getRecordsAddressListFactory (): Promise<Array<string>> {
    const index = await this._getDeployedIndex();
    return index.methods.getHotels().call();
  }

  /**
   * Generates transaction data required for adding a totally new hotel
   * and more metadata required for sucessful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When hotelData does not contain dataUri property.
   * @throws {InputDataError} When hotelData does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async addHotel (hotelData: HotelInterface): Promise<PreparedTransactionMetadataInterface> {
    return this.addRecord(hotelData);
  }

  /**
   * Generates a list of transaction data required for updating a hotel
   * and more metadata required for sucessful mining of those transactions.
   * Does not sign or send any of the transactions.
   *
   * @throws {InputDataError} When hotel does not have a manager field.
   * @throws {InputDataError} When hotel does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async updateHotel (hotel: HotelInterface): Promise<Array<PreparedTransactionMetadataInterface>> {
    return this.updateRecord(hotel);
  }

  /**
   * Generates transaction data required for removing a hotel
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When hotel does not contain dataUri property.
   * @throws {InputDataError} When hotel does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async removeHotel (hotel: HotelInterface): Promise<PreparedTransactionMetadataInterface> {
    return this.removeRecord(hotel);
  }

  /**
   * Generates transaction data required for transferring a hotel
   * ownership and more metadata required for successful mining of that
   * transactoin. Does not sign or send the transaction.
   *
   * @throws {InputDataError} When hotel does not have an address.
   * @throws {InputDataError} When hotel does not contain a manager property.
   * @throws {InputDataError} When the new manager address is the same as the old manager.
   * @throws {InputDataError} When the new manager address is not a valid address.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async transferHotelOwnership (hotel: HotelInterface, newManager: string): Promise<PreparedTransactionMetadataInterface> {
    return this.transferRecordOwnership(hotel, newManager);
  }

  /**
   * Gets hotel representation of a hotel on a given address. If hotel
   * on such address is not registered through this Winding Tree index
   * instance, the method throws immediately.
   *
   * @throws {HotelNotFoundError} When hotel does not exist.
   * @throws {HotelNotInstantiableError} When the hotel class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getHotel (address: string): Promise<?HotelInterface> {
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
  async getAllHotels (): Promise<Array<HotelInterface>> {
    try {
      const list = await this.getAllRecords();
      return list;
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

  async getLifTokenAddress (): Promise<string> {
    const index = await this._getDeployedIndex();
    return index.methods.LifToken().call();
  }
}

export default WTHotelIndex;
