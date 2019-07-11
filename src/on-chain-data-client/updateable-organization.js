import RemotelyBackedDataset from './remotely-backed-dataset';
import Organization from './organization';
import StoragePointer from './storage-pointer';
import { InputDataError, SmartContractInstantiationError } from './errors';

/**
 * Wrapper class for an organization backed by a smart contract on
 * Ethereum that's holding `orgJsonUri` pointer to its data.
 *
 * This is meant as a read/write wrapper. If you want to change some field,
 * just use its setter and call `updateOnChainData` when ready. This will produce
 * as many transactions as necessary for you to execute on chain.
 *
 */
export class UpdateableOnChainOrganization extends Organization {
  static createInstance (web3Utils, web3Contracts, address) {
    const org = new UpdateableOnChainOrganization(web3Utils, web3Contracts, address);
    org.initialize();
    return org;
  }

  initialize () {
    this.onChainDataset = RemotelyBackedDataset.createInstance();
    this.onChainDataset.bindProperties({
      fields: {
        _orgJsonUri: {
          remoteGetter: async () => {
            return (await this._getContractInstance()).methods.getOrgJsonUri().call();
          },
          remoteSetter: this._editInfoOnChain.bind(this),
        },
        _owner: {
          remoteGetter: async () => {
            return (await this._getContractInstance()).methods.owner().call();
          },
        },
        _associatedKeys: {
          remoteGetter: async () => {
            return (await this._getContractInstance()).methods.getAssociatedKeys().call();
          },
        },
      },
    }, this);
    this._initialized = true;
    if (this.address) {
      this.onChainDataset.markDeployed();
    }
  }

  async _getContractInstance () {
    if (!this.address) {
      throw new SmartContractInstantiationError('Cannot get Organization instance without address');
    }
    if (!this.contractInstance) {
      this.contractInstance = await this.web3Contracts.getUpdateableOrganizationInstance(this.address);
    }
    return this.contractInstance;
  }

  get orgJson () {
    return (async () => {
      if (!this._orgJson) {
        // we leverage StoragePointer to make this work with various off-chain storages
        // no direct linked subdocuments though for now
        this._orgJson = StoragePointer.createInstance(await this.orgJsonUri, {});
      }
      return this._orgJson;
    })();
  }

  get orgJsonUri () {
    if (!this._initialized) {
      return;
    }
    return (async () => {
      const orgJsonUri = await this._orgJsonUri;
      return orgJsonUri;
    })();
  }

  get owner () {
    if (!this._initialized) {
      return;
    }
    return (async () => {
      const manager = await this._owner;
      return manager;
    })();
  }

  get associatedKeys () {
    if (!this._initialized) {
      return;
    }
    return (async () => {
      const associatedKeys = await this._associatedKeys;
      return associatedKeys;
    })();
  }

  set orgJsonUri (newOrgJsonUri) {
    if (!newOrgJsonUri) {
      throw new InputDataError(
        'Cannot update Organization: Cannot set orgJsonUri when it is not provided'
      );
    }
    if (typeof newOrgJsonUri === 'string' && !newOrgJsonUri.match(/([a-z-]+):\/\//)) {
      throw new InputDataError(
        'Cannot update Organization: Cannot set orgJsonUri with invalid format'
      );
    }
    if (newOrgJsonUri !== this._orgJsonUri) {
      this._orgJson = null;
    }

    this._orgJsonUri = newOrgJsonUri;
  }

  async setLocalData (newData) {
    const newOrgJsonUri = await newData.orgJsonUri;
    if (newOrgJsonUri) {
      this.orgJsonUri = newOrgJsonUri;
    }
  }

  async _editInfoOnChain (transactionOptions) {
    const contract = await this._getContractInstance();
    const estimate = contract.methods.changeOrgJsonUri(await this.orgJsonUri).estimateGas({
      from: transactionOptions.from,
    });
    const txData = contract.methods.changeOrgJsonUri(await this.orgJsonUri).encodeABI({
      from: transactionOptions.from,
    });
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: txData,
      from: transactionOptions.from,
      to: this.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    return {
      organization: this,
      transactionData: transactionData,
    };
  }

  async updateOnChainData (transactionOptions) {
    // TODO somehow check that the contract supports this interface
    // pre-check if contract is available at all and fail fast
    await this._getContractInstance();
    // We have to clone options for each dataset as they may get modified
    // along the way
    return this.onChainDataset.updateRemoteData(Object.assign({}, transactionOptions));
  }

  async transferOnChainOwnership (newOwner, transactionOptions) {
    if (!this.onChainDataset.isDeployed()) {
      throw new SmartContractInstantiationError('Cannot transfer Organization: not deployed');
    }
    const contract = await this._getContractInstance();
    const estimate = contract.methods.transferOwnership(newOwner).estimateGas();
    const txData = contract.methods.transferOwnership(newOwner).encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: txData,
      from: transactionOptions.from,
      to: this.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    const eventCallbacks = {
      onReceipt: (receipt) => {
        this._owner = newOwner;
      },
    };
    return {
      organization: this,
      transactionData: transactionData,
      eventCallbacks: eventCallbacks,
    };
  }
}

export default UpdateableOnChainOrganization;
