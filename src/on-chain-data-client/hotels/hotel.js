// @flow
import type {
  TransactionOptionsInterface,
  BasePreparedTransactionMetadataInterface,
} from '../../interfaces/base-interfaces';

import type { HotelInterface, PreparedTransactionMetadataInterface } from '../../interfaces/hotel-interfaces';
import Utils from '../utils';
import OnChainRecord from '../wt-index/record';
import Contracts from '../contracts';

/**
 * Wrapper class for a hotel backed by a smart contract on
 * Ethereum that's holding `dataUri` pointer to its data.
 *
 * It provides an accessor to such data in a form of
 * `StoragePointer` instance under `dataIndex` property.
 * Every schema-specific implementation details
 * are dealt with in StoragePointer.
 *
 */
class OnChainHotel extends OnChainRecord implements HotelInterface {
  /**
   * Create new configured instance.
   * @param  {Utils} web3Utils
   * @param  {Contracts} web3Contracts
   * @param  {web3.eth.Contract} indexContract Representation of Winding Tree index
   * @param  {string} address is an optional pointer to Ethereum network where the hotle lives.
   * It is used as a reference for on-chain stored data. If it is not provided, an hotel has
   * to be created on chain to behave as expected.
   * @return {OnChainHotel}
   */
  static createInstance (web3Utils: Utils, web3Contracts: Contracts, indexContract: Object, address?: string): OnChainHotel {
    const hotel = new OnChainHotel(web3Utils, web3Contracts, indexContract, address);
    hotel.RECORD_TYPE = 'hotel';
    hotel.initialize();
    return hotel;
  }

  _getStoragePointerLayoutFactory (): Object {
    return {
      descriptionUri: { required: true },
      ratePlansUri: { required: false },
      availabilityUri: { required: false },
    };
  }

  _getRecordContractFactory (): Object {
    return this.web3Contracts.getHotelInstance(this.address);
  }

  _callRecordInContract (data: string): Object {
    return this.indexContract.methods.callHotel(this.address, data);
  }

  _registerRecordInContract (dataUri: ?string): Object {
    return this.indexContract.methods.registerHotel(dataUri);
  }

  _transferRecordInContract (newManager: string): Object {
    return this.indexContract.methods.transferHotel(this.address, newManager);
  }

  _deleteRecordInContract (): Object {
    return this.indexContract.methods.deleteHotel(this.address);
  }

  /**
   * Generates transaction data and metadata for creating new hotel contract on-chain.
   * Transaction is not signed nor sent here.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<PreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created hotel instance.
   */
  async createOnChainData (transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface> {
    const result = await this._createOnChainData(transactionOptions);
    result.hotel = result.record;
    delete result.record;
    return result;
  }

  /**
   * This is potentially devastating, so it's better to name
   * this operation explicitly instead of hiding it under updateOnChainData.
   *
   * Generates transaction data and metadata required for a hotel ownership
   * transfer.
   *
   * @param {string} Address of a new manager
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @return {Promise<PreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created hotel instance.
   *
   */
  async transferOnChainOwnership (newManager: string, transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface> {
    const result = await this._transferOnChainOwnership(newManager, transactionOptions);
    result.hotel = result.record;
    delete result.record;
    return result;
  }

  /**
   * Generates transaction data and metadata required for destroying the hotel object on network.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @return {Promise<PreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created hotel instance.
   */
  async removeOnChainData (transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface> {
    const result = await this._removeOnChainData(transactionOptions);
    result.hotel = result.record;
    delete result.record;
    return result;
  }

  /**
   * Generates transaction data and metadata required for all hotel-related data modification
   * by calling `updateRemoteData` on a `RemotelyBackedDataset`.
   *
   * @param {TransactionOptionsInterface} options object that is passed to all remote data setters
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @throws {SmartContractInstantiationError} When dataUri is empty.
   * @return {Promise<Array<PreparedTransactionMetadataInterface>>} List of transaction metadata
   */
  async updateOnChainData (transactionOptions: TransactionOptionsInterface): Promise<Array<BasePreparedTransactionMetadataInterface>> {
    const results = (await this._updateOnChainData(transactionOptions))
      .map((result) => {
        result.hotel = result.record;
        delete result.record;
        return result;
      });
    return results;
  }
}

export default OnChainHotel;
