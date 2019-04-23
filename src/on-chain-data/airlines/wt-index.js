// @flow
import type { WTAirlineIndexInterface, AirlineInterface, PreparedTransactionMetadataInterface } from '../../interfaces/airline-interfaces';
import Utils from '../utils';
import Contracts from '../contracts';
import OnChainAirline from './airline';

import { AirlineNotFoundError, AirlineNotInstantiableError, RecordNotFoundError, RecordNotInstantiableError } from '../errors';
import AbstractWTIndex from '../wt-index';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * index wrapper. It provides methods for working with airline
 * contracts.
 */
class WTAirlineIndex extends AbstractWTIndex implements WTAirlineIndexInterface {
  /**
   * Returns a configured instance of WTAirlineIndex
   * representing a Winding Tree index contract on a given `indexAddress`.
   */
  static createInstance (indexAddress: string, web3Utils: Utils, web3Contracts: Contracts): WTAirlineIndex {
    const instance = new WTAirlineIndex(indexAddress, web3Utils, web3Contracts);
    instance.RECORD_TYPE = 'airline';
    return instance;
  }

  async _getDeployedIndexFactory (): Promise<Object> {
    return this.web3Contracts.getAirlineIndexInstance(this.address);
  }

  async _createRecordInstanceFactory (address?: string): Promise<Object> {
    return OnChainAirline.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedIndex(), address);
  }

  async _getIndexRecordPositionFactory (address: string): Promise<number> {
    const index = await this._getDeployedIndex();
    return parseInt(await index.methods.airlinesIndex(address).call(), 10);
  }

  async _getRecordsAddressListFactory (): Promise<Array<string>> {
    const index = await this._getDeployedIndex();
    return index.methods.getAirlines().call();
  }

  /**
   * Generates transaction data required for adding a totally new airline
   * and more metadata required for sucessful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When airlineData does not contain dataUri property.
   * @throws {InputDataError} When airlineData does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async addAirline (airlineData: AirlineInterface): Promise<PreparedTransactionMetadataInterface> {
    return this.addRecord(airlineData);
  }

  /**
   * Generates a list of transaction data required for updating a airline
   * and more metadata required for sucessful mining of those transactions.
   * Does not sign or send any of the transactions.
   *
   * @throws {InputDataError} When airline does not have a manager field.
   * @throws {InputDataError} When airline does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async updateAirline (airline: AirlineInterface): Promise<Array<PreparedTransactionMetadataInterface>> {
    return this.updateRecord(airline);
  }

  /**
   * Generates transaction data required for removing a airline
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When airline does not contain dataUri property.
   * @throws {InputDataError} When airline does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async removeAirline (airline: AirlineInterface): Promise<PreparedTransactionMetadataInterface> {
    return this.removeRecord(airline);
  }

  /**
   * Generates transaction data required for transferring a airline
   * ownership and more metadata required for successful mining of that
   * transactoin. Does not sign or send the transaction.
   *
   * @throws {InputDataError} When airline does not have an address.
   * @throws {InputDataError} When airline does not contain a manager property.
   * @throws {InputDataError} When the new manager address is the same as the old manager.
   * @throws {InputDataError} When the new manager address is not a valid address.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async transferAirlineOwnership (airline: AirlineInterface, newManager: string): Promise<PreparedTransactionMetadataInterface> {
    return this.transferRecordOwnership(airline, newManager);
  }

  /**
   * Gets airline representation of a airline on a given address. If airline
   * on such address is not registered through this Winding Tree index
   * instance, the method throws immediately.
   *
   * @throws {AirlineNotFoundError} When airline does not exist.
   * @throws {AirlineNotInstantiableError} When the airline class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getAirline (address: string): Promise<?AirlineInterface> {
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

  /**
   * Returns a list of all airlines. It will filter out
   * every airline that is inaccessible for any reason.
   *
   * Currently any inaccessible airline is silently ignored.
   * Subject to change.
   */
  async getAllAirlines (): Promise<Array<AirlineInterface>> {
    return this.getAllRecords();
  }
}

export default WTAirlineIndex;
