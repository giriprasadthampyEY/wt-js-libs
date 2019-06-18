import OnChainRecord from '../directory/record';

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

  async hasAssociatedKey (associatedAddress, transactionOptions) {
    return this._hasAssociatedKey(associatedAddress, transactionOptions);
  }
}

export default OnChainHotel;
