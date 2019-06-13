// @flow
import type {
  TransactionOptionsInterface,
  BasePreparedTransactionMetadataInterface,
} from '../../interfaces/base-interfaces';

import type { AirlineInterface, PreparedTransactionMetadataInterface } from '../../interfaces/airline-interfaces';
import Utils from '../utils';
import OnChainRecord from '../directory/record';
import Contracts from '../contracts';

/**
 * Wrapper class for an airline backed by a smart contract on
 * Ethereum that's holding `orgJsonUri` pointer to its data.
 *
 * It provides an accessor to such data in a form of
 * `StoragePointer` instance under `dataIndex` property.
 * Every schema-specific implementation details
 * are dealt with in StoragePointer.
 *
 */
class OnChainAirline extends OnChainRecord implements AirlineInterface {
  /**
   * Create new configured instance.
   * @param  {Utils} web3Utils
   * @param  {Contracts} web3Contracts
   * @param  {web3.eth.Contract} directoryContract Representation of Winding Tree directory
   * @param  {string} address is an optional pointer to Ethereum network where the airline lives.
   * It is used as a reference for on-chain stored data. If it is not provided, an airline has
   * to be created on chain to behave as expected.
   * @return {OnChainAirline}
   */
  static createInstance (web3Utils: Utils, web3Contracts: Contracts, directoryContract: Object, address?: string): OnChainAirline {
    const airline = new OnChainAirline(web3Utils, web3Contracts, directoryContract, address);
    airline.RECORD_TYPE = 'airline';
    airline.initialize();
    return airline;
  }

  _getStoragePointerLayoutFactory (): Object {
    return {
      descriptionUri: { required: true },
      flightsUri: { required: false, children: { items: { children: { flightInstancesUri: { required: false } } } } },
    };
  }

  _getRecordContractFactory (): Object {
    return this.web3Contracts.getOrganizationInstance(this.address);
  }

  // _changeOrgJsonUriFactory (data: string): Object {
  //   return this.directoryContract.methods.changeOrgJsonUri(this.address, data);
  // }

  _registerRecordInDirectoryFactory (orgJsonUri: ?string): Object {
    return this.directoryContract.methods.add(orgJsonUri);
  }

  _deleteRecordInDirectoryFactory (): Object {
    return this.directoryContract.methods.remove(this.address);
  }

  /**
   * Generates transaction data and metadata for creating new airline contract on-chain.
   * Transaction is not signed nor sent here.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<PreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created airline instance.
   */
  async createOnChainData (transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface> {
    const result = await this._createOnChainData(transactionOptions);
    result.airline = result.record;
    delete result.record;
    return result;
  }

  /**
   * This is potentially devastating, so it's better to name
   * this operation explicitly instead of hiding it under updateOnChainData.
   *
   * Generates transaction data and metadata required for a airline ownership
   * transfer.
   *
   * @param {string} newOwner Address of a new owner
   * @param {TransactionOptionsInterface} transactionOptions Options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @return {Promise<PreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created airline instance.
   *
   */
  async transferOnChainOwnership (newOwner: string, transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface> {
    const result = await this._transferOnChainOwnership(newOwner, transactionOptions);
    result.airline = result.record;
    delete result.record;
    return result;
  }

  /**
   * Generates transaction data and metadata required for destroying the airline object on network.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @return {Promise<PreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created airline instance.
   */
  async removeOnChainData (transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface> {
    const result = await this._removeOnChainData(transactionOptions);
    result.airline = result.record;
    delete result.record;
    return result;
  }

  /**
   * Generates transaction data and metadata required for all airline-related data modification
   * by calling `updateRemoteData` on a `RemotelyBackedDataset`.
   *
   * @param {TransactionOptionsInterface} options object that is passed to all remote data setters
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @throws {SmartContractInstantiationError} When orgJsonUri is empty.
   * @return {Promise<Array<PreparedTransactionMetadataInterface>>} List of transaction metadata
   */
  async updateOnChainData (transactionOptions: TransactionOptionsInterface): Promise<Array<BasePreparedTransactionMetadataInterface>> {
    const results = (await this._updateOnChainData(transactionOptions))
      .map((result) => {
        result.airline = result.record;
        delete result.record;
        return result;
      });
    return results;
  }

  // async getOrgJsonUri (transactionOptions: TransactionOptionsInterface): Promise<?string> | ?string {
  //   console.log('OnChainAirline.getOrgJsonUri');
  //   return this._orgJsonUri;
  //   // const contract = await this._getRecordContractFactory();
  //   // return contract.getOrgJsonUri();
  // }
}

export default OnChainAirline;
