import { WTLibsError } from '../errors';
import { InputDataError } from './errors';

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
      return {
        factory: this,
        transactionData: transactionData,
      };
    } catch (err) {
      throw new WTLibsError(`Cannot create Organization: ${err.message}`, err);
    }
  }
}

export default OrganizationFactory;
