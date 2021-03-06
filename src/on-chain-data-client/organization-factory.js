import { WTLibsError } from '../errors';
import { InputDataError } from './errors';
import UpdateableOnChainOrganization from './updateable-organization';
import OnChainDataClient from './index';

/**
 * Wrapper for an Organization Factory smart contract. Allows you to
 * call `create` or `createAndAddOrganization`.
 */
export class OrganizationFactory {
  static createInstance (factoryAddress, web3Utils, web3Contracts) {
    return new OrganizationFactory(factoryAddress, web3Utils, web3Contracts);
  }

  constructor (factoryAddress, web3Utils, web3Contracts) {
    this.address = factoryAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async _getDeployedFactory () {
    if (!this.deployedFactory) {
      this.deployedFactory = await this.web3Contracts.getOrganizationFactoryInstance(this.address);
    }
    return this.deployedFactory;
  }

  /**
   * Prepares transaction data that creates and adds the organization
   * to the selected directory.
   *
   * @param  {Object} orgData
   * @param  {string} directoryAddress
   * @return {Object} Contains `transactionData`, `eventCAllbacks` useful
   * in the wallet abstraction and `organization` Promise that gets fullfilled
   * once the `onReceipt` event occurs.
   */
  async createAndAddOrganization (orgData, directoryAddress) {
    const orgJsonUri = await orgData.orgJsonUri;
    if (!orgJsonUri) {
      throw new InputDataError('Cannot create and add Organization: Missing orgJsonUri');
    }
    const orgJsonHash = await orgData.orgJsonHash;
    if (!orgJsonHash) {
      throw new InputDataError('Cannot create and add Organization: Missing orgJsonHash');
    }
    const orgOwner = await orgData.owner;
    if (!orgOwner) {
      throw new InputDataError('Cannot create and add Organization: Missing owner');
    }
    if (!directoryAddress) {
      throw new InputDataError('Cannot create and add Organization: Missing directory address');
    }
    try {
      const directory = await this._getDeployedFactory();
      const contractMethod = directory.methods.createAndAddToDirectory(orgJsonUri, orgJsonHash, directoryAddress);
      return this._callContract(contractMethod, orgOwner);
    } catch (err) {
      throw new WTLibsError(`Cannot create and add Organization: ${err.message}`, err);
    }
  }

  /**
   * Prepares transaction data that creates a new organization smart contract.
   *
   * @param  {Object} orgData
   * @return {Object} Contains `transactionData`, `eventCallbacks` useful
   * in the wallet abstraction and `organization` Promise that gets fullfilled
   * once the `onReceipt` event occurs.
   */
  async createOrganization (orgData) {
    const orgJsonUri = await orgData.orgJsonUri;
    if (!orgJsonUri) {
      throw new InputDataError('Cannot create Organization: Missing orgJsonUri');
    }
    const orgJsonHash = await orgData.orgJsonHash;
    if (!orgJsonHash) {
      throw new InputDataError('Cannot create Organization: Missing orgJsonHash');
    }
    const orgOwner = await orgData.owner;
    if (!orgOwner) {
      throw new InputDataError('Cannot create Organization: Missing owner');
    }
    try {
      const directory = await this._getDeployedFactory();
      const contractMethod = directory.methods.create(orgJsonUri, orgJsonHash);
      return this._callContract(contractMethod, orgOwner);
    } catch (err) {
      throw new WTLibsError(`Cannot create Organization: ${err.message}`, err);
    }
  }

  async _callContract (contractMethod, caller) {
    const data = contractMethod.encodeABI();
    const estimate = contractMethod.estimateGas({ from: caller });
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(caller),
      data: data,
      from: caller,
      to: this.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    let resolveOrgPromise, rejectOrgPromise;
    const orgPromise = new Promise((resolve, reject) => {
      resolveOrgPromise = resolve;
      rejectOrgPromise = reject;
    });
    return {
      transactionData: transactionData,
      organization: orgPromise,
      eventCallbacks: {
        onReceipt: (receipt) => {
          try {
            const decodedLogs = OnChainDataClient.web3Contracts.decodeLogs(receipt.logs);
            const orgAddress = decodedLogs[1].attributes[0].value;
            const organization = UpdateableOnChainOrganization.createInstance(this.web3Utils, this.web3Contracts, orgAddress);
            resolveOrgPromise(organization);
          } catch (err) {
            rejectOrgPromise(err);
          }
        },
      },
    };
  }
}

export default OrganizationFactory;
