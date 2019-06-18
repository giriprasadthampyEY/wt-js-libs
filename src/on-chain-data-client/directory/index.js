import { WTLibsError } from '../../errors';
import { InputDataError, RecordNotFoundError, RecordNotInstantiableError } from '../errors';
import OnChainOrganization from './organization';

export class SegmentDirectory {
  static createInstance (address, web3Utils, web3Contracts) {
    return new SegmentDirectory(address, web3Utils, web3Contracts);
  }

  constructor (address, web3Utils, web3Contracts) {
    this.address = address;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async _getDeployedDirectory () {
    if (!this.deployedDirectory) {
      this.deployedDirectory = await this.web3Contracts.getSegmentDirectoryInstance(this.address);
    }
    return this.deployedDirectory;
  }

  /**
   * Generates transaction data required for adding an organization
   * and more metadata required for sucessful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When recordData does not contain orgJsonUri property.
   * @throws {InputDataError} When recordData does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async add (recordData) {
    if (!recordData.address) {
      throw new InputDataError('Cannot add Organization without address.');
    }
    const recordOwner = await recordData.owner;
    if (!recordOwner) {
      throw new InputDataError('Cannot add Organization without owner.');
    }
    try {
      const directory = await this._getDeployedDirectory();
      const data = directory.methods.add(recordData.address).encodeABI();
      const estimate = directory.methods.add(recordData.address).estimateGas({ from: recordOwner });
      const transactionData = {
        nonce: await this.web3Utils.determineCurrentAddressNonce(recordOwner),
        data: data,
        from: recordOwner,
        to: this.address,
        gas: this.web3Utils.applyGasModifier(await estimate),
      };
      return {
        directory: this,
        transactionData: transactionData,
      };
    } catch (err) {
      throw new WTLibsError(`Cannot add Organization: ${err.message}`, err);
    }
  }

  /**
   * Generates transaction data required for removing an organization
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When organization does not contain orgJsonUri property.
   * @throws {InputDataError} When organization does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async remove (recordData) {
    if (!recordData.address) {
      throw new InputDataError('Cannot remove Organization without address.');
    }
    const recordOwner = await recordData.owner;
    if (!recordOwner) {
      throw new InputDataError('Cannot remove Organization without owner.');
    }
    try {
      const directory = await this._getDeployedDirectory();
      const data = directory.methods.remove(recordData.address).encodeABI();
      const estimate = directory.methods.remove(recordData.address).estimateGas({ from: recordOwner });
      const transactionData = {
        nonce: await this.web3Utils.determineCurrentAddressNonce(recordOwner),
        data: data,
        from: recordOwner,
        to: this.address,
        gas: this.web3Utils.applyGasModifier(await estimate),
      };
      return {
        directory: this,
        transactionData: transactionData,
      };
    } catch (err) {
      throw new WTLibsError(`Cannot remove Organization: ${err.message}`, err);
    }
  }

  /**
   * Gets organization representation of a organization on a given address. If organization
   * on such address is not registered through this Winding Tree index
   * instance, the method throws immediately.
   *
   * @throws {RecordNotFoundError} When organization does not exist.
   * @throws {RecordNotInstantiableError} When the organization class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getOrganization (address) {
    let recordIndex;
    try {
      // This returns strings
      recordIndex = await this.getOrganizationIndex(address);
    } catch (err) {
      throw new WTLibsError(`Cannot find Organization at ${address}: ${err.message}`, err);
    }
    // Zeroeth position is reserved as empty during index deployment
    if (!recordIndex) {
      throw new RecordNotFoundError(`Cannot find Organization at ${address}: Not found in Organization list`);
    } else {
      try {
        return OnChainOrganization.createInstance(this.web3Utils, this.web3Contracts, address);
      } catch (err) {
        throw new RecordNotInstantiableError(`Cannot instantiate Organization at ${address}: ${err.message}`, err);
      }
    }
  }

  async getOrganizationIndex (address) {
    const directory = await this._getDeployedDirectory();
    return parseInt(await directory.methods.organizationsIndex(address).call(), 10);
  }

  async getOrganizationByIndex (recordIndex) {
    const directory = await this._getDeployedDirectory();
    const address = await directory.methods.organizations(recordIndex).call();
    return this.getOrganization(address);
  }

  /**
   * Returns a list of all organizations. It will filter out
   * every organization that is inaccessible for any reason.
   *
   * Currently any inaccessible organization is silently ignored.
   * Subject to change.
   */
  async getOrganizations () {
    const directory = await this._getDeployedDirectory();
    const recordsAddressList = await directory.methods.getOrganizations().call();
    let getRecordDetails = recordsAddressList
      // Filtering null addresses beforehand improves efficiency
      .filter((addr) => !this.web3Utils.isZeroAddress(addr))
      .map((addr) => {
        return this.getOrganization(addr) // eslint-disable-line promise/no-nesting
          // We don't really care why the organization is inaccessible
          // and we need to catch exceptions here on each individual organization
          .catch((err) => { // eslint-disable-line
            return null;
          });
      });
    const recordDetails = await (Promise.all(getRecordDetails));
    const recordList = (recordDetails.filter(a => a != null));
    return recordList;
  }

  async getLifTokenAddress () {
    const index = await this._getDeployedDirectory();
    return index.methods.getLifToken().call();
  }

  async getSegment (transactionOptions = {}) {
    const directory = await this._getDeployedDirectory();
    return directory.methods.getSegment().call(transactionOptions);
  }
}

export default SegmentDirectory;
