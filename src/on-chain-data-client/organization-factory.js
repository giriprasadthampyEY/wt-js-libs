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

  async createOrganization (orgData) {
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
      const data = directory.methods.create(orgData.orgJsonUri).encodeABI();
      const estimate = directory.methods.create(orgData.orgJsonUri).estimateGas({ from: orgOwner });
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
              return
            } catch (err) {
              rejectOrgPromise(err);
            }
          },
        },
        organization: orgPromise,
      };
    } catch (err) {
      throw new WTLibsError(`Cannot create Organization: ${err.message}`, err);
    }
  }
}

export default OrganizationFactory;
