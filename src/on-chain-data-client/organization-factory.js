import { WTLibsError } from '../errors';
import { InputDataError } from './errors';
import OnChainOrganization from './organization';
import OnChainDataClient from './index';

class OrganizationFactory {
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

  async createAndAddOrganization (orgData, directoryAddress) {
    return this._createOrganization(orgData, true, directoryAddress);
  }

  async createOrganization (orgData) {
    return this._createOrganization(orgData, false);
  }

  async _createOrganization (orgData, alsoAdd = false, directoryAddress) {
    const orgJsonUri = await orgData.orgJsonUri;
    if (!orgJsonUri) {
      throw new InputDataError('Cannot create Organization: Missing orgJsonUri');
    }
    const orgOwner = await orgData.owner;
    if (!orgOwner) {
      throw new InputDataError('Cannot create Organization: Missing owner');
    }
    try {
      const directory = await this._getDeployedFactory();
      const fn = alsoAdd
        ? directory.methods.createAndAddToDirectory(orgData.orgJsonUri, directoryAddress)
        : directory.methods.create(orgData.orgJsonUri);
      const data = fn.encodeABI();
      const estimate = fn.estimateGas({ from: orgOwner });
      const transactionData = {
        nonce: await this.web3Utils.determineCurrentAddressNonce(orgOwner),
        data: data,
        from: orgOwner,
        to: this.address,
        gas: this.web3Utils.applyGasModifier(await estimate),
      };
      let resolveOrgPromise, rejectOrgPromise;
      const orgPromise = new Promise(async (resolve, reject) => {
        resolveOrgPromise = resolve;
        rejectOrgPromise = reject;
      });
      return {
        transactionData: transactionData,
        eventCallbacks: {
          onReceipt: (receipt) => {
            try {
              let decodedLogs = OnChainDataClient.web3Contracts.decodeLogs(receipt.logs);
              const orgAddress = decodedLogs[1].attributes[0].value;
              const organization = OnChainOrganization.createInstance(this.web3Utils, this.web3Contracts, orgAddress);
              resolveOrgPromise(organization);
            } catch (err) {
              rejectOrgPromise(err);
            }
          },
        },
        organization: orgPromise,
      };
    } catch (err) {
      throw new WTLibsError(`Cannot ${alsoAdd ? 'create and add' : 'create'} Organization: ${err.message}`, err);
    }
  }
}

export default OrganizationFactory;
