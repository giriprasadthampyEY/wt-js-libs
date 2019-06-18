import OnChainRecord from '../directory/record';

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
class OnChainAirline extends OnChainRecord {
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
  static createInstance (web3Utils, web3Contracts, directoryContract, address) {
    const airline = new OnChainAirline(web3Utils, web3Contracts, directoryContract, address);
    airline.RECORD_TYPE = 'airline';
    airline.initialize();
    return airline;
  }

  _getStoragePointerLayoutFactory () {
    return {
      descriptionUri: { required: true },
      flightsUri: { required: false, children: { items: { children: { flightInstancesUri: { required: false } } } } },
    };
  }

  _getRecordContractFactory () {
    return this.web3Contracts.getOrganizationInstance(this.address);
  }

  async hasAssociatedKey (associatedAddress, transactionOptions) {
    return this._hasAssociatedKey(associatedAddress, transactionOptions);
  }
}

export default OnChainAirline;
