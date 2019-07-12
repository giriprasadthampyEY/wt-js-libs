import { WTLibsError } from '../errors';
import { InputDataError, OrganizationNotFoundError, OrganizationNotInstantiableError } from './errors';
import OnChainOrganization from './organization';

/**
 * Wrapper class for a SegmentDirectory smart contract. Allows you to
 * add and remove organizations from this directory.
 */
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
   * @throws {InputDataError} When orgData does not contain orgJsonUri property.
   * @throws {InputDataError} When orgData does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async add (orgData) {
    if (!orgData.address) {
      throw new InputDataError('Cannot add Organization without address.');
    }
    const orgOwner = await orgData.owner;
    if (!orgOwner) {
      throw new InputDataError('Cannot add Organization without owner.');
    }
    try {
      const directory = await this._getDeployedDirectory();
      const data = directory.methods.add(orgData.address).encodeABI();
      const estimate = directory.methods.add(orgData.address).estimateGas({ from: orgOwner });
      const transactionData = {
        nonce: await this.web3Utils.determineCurrentAddressNonce(orgOwner),
        data: data,
        from: orgOwner,
        to: this.address,
        gas: this.web3Utils.applyGasModifier(await estimate),
      };
      return {
        transactionData: transactionData,
        eventCallbacks: {
          onReceipt: () => {}, // use empty callback to ensure consistent behaviour of all tx methods
        },
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
  async remove (orgData) {
    if (!orgData.address) {
      throw new InputDataError('Cannot remove Organization without address.');
    }
    const orgOwner = await orgData.owner;
    if (!orgOwner) {
      throw new InputDataError('Cannot remove Organization without owner.');
    }
    try {
      const directory = await this._getDeployedDirectory();
      const data = directory.methods.remove(orgData.address).encodeABI();
      const estimate = directory.methods.remove(orgData.address).estimateGas({ from: orgOwner });
      const transactionData = {
        nonce: await this.web3Utils.determineCurrentAddressNonce(orgOwner),
        data: data,
        from: orgOwner,
        to: this.address,
        gas: this.web3Utils.applyGasModifier(await estimate),
      };
      return {
        transactionData: transactionData,
        eventCallbacks: {
          onReceipt: () => {}, // use empty callback to ensure consistent behaviour of all tx methods
        },
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
   * @throws {OrganizationNotFoundError} When organization does not exist.
   * @throws {OrganizationNotInstantiableError} When the organization class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getOrganization (address) {
    let organizationIndex;
    try {
      // This returns strings
      organizationIndex = await this.getOrganizationIndex(address);
    } catch (err) {
      throw new WTLibsError(`Cannot find Organization at ${address}: ${err.message}`, err);
    }
    // Zeroeth position is reserved as empty during index deployment
    if (!organizationIndex) {
      throw new OrganizationNotFoundError(`Cannot find Organization at ${address}: Not found in Organization list`);
    } else {
      try {
        return OnChainOrganization.createInstance(this.web3Utils, this.web3Contracts, address);
      } catch (err) {
        throw new OrganizationNotInstantiableError(`Cannot instantiate Organization at ${address}: ${err.message}`, err);
      }
    }
  }

  async getOrganizationIndex (address) {
    const directory = await this._getDeployedDirectory();
    return parseInt(await directory.methods.organizationsIndex(address).call(), 10);
  }

  async getOrganizationByIndex (organizationIndex) {
    const directory = await this._getDeployedDirectory();
    const address = await directory.methods.organizations(organizationIndex).call();
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
    const orgAddressList = await directory.methods.getOrganizations().call();
    let getOrgDetails = orgAddressList
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
    const orgDetails = await (Promise.all(getOrgDetails));
    return (orgDetails.filter(a => a != null));
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
