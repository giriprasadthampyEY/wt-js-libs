import Utils from '../utils';
import OnChainRecord from '../directory/record';
import Contracts from '../contracts';

/**
 * Wrapper class for a hotel backed by a smart contract on
 * Ethereum that's holding `orgJsonUri` pointer to its data.
 *
 * It provides an accessor to such data in a form of
 * `StoragePointer` instance under `dataIndex` property.
 * Every schema-specific implementation details
 * are dealt with in StoragePointer.
 *
 */
class OnChainHotel extends OnChainRecord {
  /**
   * Create new configured instance.
   * @param  {Utils} web3Utils
   * @param  {Contracts} web3Contracts
   * @param  {web3.eth.Contract} directoryContract Representation of Winding Tree directory
   * @param  {string} address is an optional pointer to Ethereum network where the hotel lives.
   * It is used as a reference for on-chain stored data. If it is not provided, an hotel has
   * to be created on chain to behave as expected.
   * @return {OnChainHotel}
   */
  static createInstance (web3Utils, web3Contracts, directoryContract, address) {
    const hotel = new OnChainHotel(web3Utils, web3Contracts, directoryContract, address);
    hotel.RECORD_TYPE = 'hotel';
    hotel.initialize();
    return hotel;
  }

  _getStoragePointerLayoutFactory () {
    return {
      descriptionUri: { required: true },
      ratePlansUri: { required: false },
      availabilityUri: { required: false },
    };
  }

  _getRecordContractFactory () {
    return this.web3Contracts.getOrganizationInstance(this.address);
  }

  _createRecordFactory (orgJsonUri) {
    return this.directoryContract.methods.create(orgJsonUri);
  }

  _createAndAddRecordFactory (orgJsonUri) {
    return this.directoryContract.methods.createAndAdd(orgJsonUri);
  }

  _deleteRecordInDirectoryFactory () {
    return this.directoryContract.methods.remove(this.address);
  }

  /**
   * Generates transaction data and metadata for creating new hotel contract on-chain.
   * Transaction is not signed nor sent here.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<PreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created hotel instance.
   */
  async createOnChainData (transactionOptions, alsoAdd = false) {
    const result = await this._createOnChainData(transactionOptions, alsoAdd);
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
  async removeOnChainData (transactionOptions) {
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
   * @throws {SmartContractInstantiationError} When orgJsonUri is empty.
   * @return {Promise<Array<PreparedTransactionMetadataInterface>>} List of transaction metadata
   */
  async updateOnChainData (transactionOptions) {
    const results = (await this._updateOnChainData(transactionOptions))
      .map((result) => {
        result.hotel = result.record;
        delete result.record;
        return result;
      });
    return results;
  }

  async hasDelegate (delegateAddress, transactionOptions) {
    return this._hasDelegate(delegateAddress, transactionOptions);
  }
}

export default OnChainHotel;
