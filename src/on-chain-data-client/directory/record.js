import RemotelyBackedDataset from '../remotely-backed-dataset';
import StoragePointer from '../storage-pointer';

import { InputDataError, SmartContractInstantiationError } from '../errors';

/**
 * Wrapper class for a <record> backed by a smart contract on
 * Ethereum that's holding `orgJsonUri` pointer to its data.
 *
 * It provides an accessor to such data in a form of
 * `StoragePointer` instance under `dataIndex` property.
 * Every schema-specific implementation details
 * are dealt with in StoragePointer.
 *
 * This should be extended by particular data types, such as hotels,
 * airlines, OTAs etc.
 */
class OnChainRecord {
  constructor (web3Utils, web3Contracts, directoryContract, address) {
    this.address = address;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this.directoryContract = directoryContract;
  }

  /**
   * Initializes the underlying RemotelyBackedDataset that actually
   * communicates with the on-chain stored data. If address was provided
   * in the contsructor, the RemotelyBackedDataset is marked as deployed
   * and can be used instantly.
   */
  initialize () {
    this.onChainDataset = RemotelyBackedDataset.createInstance();
    this.onChainDataset.bindProperties({
      fields: {
        _orgJsonUri: {
          remoteGetter: async () => {
            return (await this._getContractInstance()).methods.getOrgJsonUri().call();
          },
          remoteSetter: this._changeOrgJsonUri.bind(this),
        },
        _owner: {
          remoteGetter: async () => {
            return (await this._getContractInstance()).methods.owner().call();
          },
        },
        _created: {
          remoteGetter: async () => {
            return (await this._getContractInstance()).methods.created().call();
          },
        },
      },
    }, this);
    this._initialized = true;
    if (this.address) {
      this.onChainDataset.markDeployed();
    }
  }

  _getStoragePointerLayoutFactory () {
    throw new Error('Cannot call _getStoragePointerLayoutFactory on class');
  }

  _getRecordContractFactory () {
    throw new Error('Cannot call _getRecordContractFactory on class');
  }

  _createRecordFactory (orgJsonUri) {
    throw new Error('Cannot call _createRecordFactory on class');
  }

  _createAndAddRecordFactory (orgJsonUri) {
    throw new Error('Cannot call _createAndAddRecordFactory on class');
  }

  _deleteRecordInDirectoryFactory () {
    throw new Error('Cannot call _deleteRecordInDirectoryFactory on class');
  }

  /**
   * Async getter for `StoragePointer` instance.
   * Since it has to eventually access the `orgJsonUri`
   * field stored on-chain, it is lazy loaded.
   */
  get dataIndex () {
    return (async () => {
      if (!this._dataIndex) {
        this._dataIndex = StoragePointer.createInstance(await this.orgJsonUri, this._getStoragePointerLayoutFactory());
      }
      return this._dataIndex;
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

  set orgJsonUri (newOrgJsonUri) {
    if (!newOrgJsonUri) {
      throw new InputDataError(
        `Cannot update ${this.RECORD_TYPE}: Cannot set orgJsonUri when it is not provided`
      );
    }
    if (typeof newOrgJsonUri === 'string' && !newOrgJsonUri.match(/([a-z-]+):\/\//)) {
      throw new InputDataError(
        `Cannot update ${this.RECORD_TYPE}: Cannot set orgJsonUri with invalid format`
      );
    }
    if (newOrgJsonUri !== this._orgJsonUri) {
      this._dataIndex = null;
    }

    this._orgJsonUri = newOrgJsonUri;
  }

  get created () {
    if (!this._initialized) {
      return;
    }
    return (async () => {
      const created = await this._created;
      return created;
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

  set owner (newOwner) {
    if (!newOwner) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE}: Cannot set owner when it is not provided`);
    }
    if (this.address) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE}: Cannot set owner when ${this.RECORD_TYPE} is deployed`);
    }
    this._owner = newOwner;
  }

  /**
   * Update owner and orgJsonUri properties. orgJsonUri can never be nulled. Owner
   * can never be nulled. Manager can be changed only for an un-deployed
   * contract (without address).
   * @param {BaseOnChainRecordInterface} newData
   */
  async setLocalData (newData) {
    const newOwner = await newData.owner;
    if (newOwner) {
      this.owner = newOwner;
    }
    const newOrgJsonUri = await newData.orgJsonUri;
    if (newOrgJsonUri) {
      this.orgJsonUri = newOrgJsonUri;
    }
  }

  /**
   * Helper method that transforms the whole <record> into a sync simple
   * JavaScript object only with data properties.
   *
   * By default, all off-chain data is resolved recursively. If you want to
   * limit off-chain data only to a certain subtree, use the resolvedFields
   * parameter that accepts an array of paths in dot notation (`father.son.child`).
   * Every last piece of every path will be resolved recursively as well. An empty
   * list means no fields will be resolved.
   *
   * Properties that represent an actual separate document have a format of
   * ```
   * {
   *   'ref': 'schema://original-url',
   *   'contents': {
   *     'actual': 'data'
   *   }
   * }
   * ```
   *
   * @param {Array<string>} resolvedFields List of fields to be resolved from off chain data, in dot notation.
   * If an empty array is provided, no resolving is done. If the argument is missing, all fields are resolved.
   * @param {number} depth Number of levels to resolve. See `StoragePointer` jsDocs for more info.
   *
   * @throws {StoragePointerError} when an adapter encounters an error while accessing the data
   */
  async toPlainObject (resolvedFields, depth) {
    const dataIndex = await this.dataIndex;
    const offChainData = await dataIndex.toPlainObject(resolvedFields, depth);
    let result = {
      owner: await this.owner,
      address: this.address,
      orgJsonUri: offChainData,
    };
    return result;
  }

  async _getContractInstance () {
    if (!this.address) {
      throw new SmartContractInstantiationError(`Cannot get ${this.RECORD_TYPE} instance without address`);
    }
    if (!this.contractInstance) {
      this.contractInstance = await this._getRecordContractFactory();
    }
    return this.contractInstance;
  }

  /**
   * Generates transaction data and metadata for updating orgJsonUri on-chain.
   * Used internally as a remoteSetter for `orgJsonUri` property.
   * Transaction is not signed nor sent here.
   *
   * @param {TransactionOptionsInterface} transactionOptions object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<BasePreparedTransactionMetadataInterface>} resulting transaction metadata
   */
  async _changeOrgJsonUri (transactionOptions) {
    const uri = await this.orgJsonUri;
    const contract = await this._getContractInstance();
    const data = contract.methods.changeOrgJsonUri(uri).encodeABI();
    const estimate = contract.methods.changeOrgJsonUri(uri).estimateGas(transactionOptions);
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: contract._address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    return {
      record: (this),
      transactionData: transactionData,
    };
  }

  /**
   * Generates transaction data and metadata for creating new <record> contract on-chain.
   * Transaction is not signed nor sent here.
   *
   * @param {TransactionOptionsInterface} transactionOptions object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<BasePreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created <record> instance.
   */
  async _createOnChainData (transactionOptions, alsoAdd = false) {
    const orgJsonUri = await this.orgJsonUri;
    const fn = alsoAdd ? (await this._createAndAddRecordFactory(orgJsonUri)) : (await this._createRecordFactory(orgJsonUri));
    const estimate = fn.estimateGas(transactionOptions);
    const data = fn.encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: this.directoryContract.options.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    const eventCallbacks = {
      onReceipt: (receipt) => {
        this.onChainDataset.markDeployed();
        if (receipt && receipt.logs) {
          // TODO web3Eth.abi.decodeLog timeouts even though the signature of OrganizationCreated
          // coming from the receipt logs is the same as in event registry. maybe gas problem?
          // (0x47b688936cae1ca5de00ac709e05309381fb9f18b4c5adb358a5b542ce67caea)
          // let decodedLogs = this.web3Contracts.decodeLogs(receipt.logs);
          // this.address = decodedLogs[0].attributes[0].value;
          this.address = receipt.logs[0].address;
        }
      },
    };
    return {
      record: this,
      transactionData: transactionData,
      eventCallbacks: eventCallbacks,
    };
  }

  async _hasDelegate (delegateAddress, transactionOptions) {
    const contract = await this._getContractInstance();
    return contract.methods.hasDelegate(delegateAddress).call(transactionOptions);
  }

  /**
   * Generates transaction data and metadata required for all <record>-related data modification
   * by calling `updateRemoteData` on a `RemotelyBackedDataset`.
   *
   * @param {TransactionOptionsInterface} options object that is passed to all remote data setters
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @throws {SmartContractInstantiationError} When orgJsonUri is empty.
   * @return {Promise<Array<BasePreparedTransactionMetadataInterface>>} List of transaction metadata
   */
  async _updateOnChainData (transactionOptions) {
    // pre-check if contract is available at all and fail fast
    await this._getContractInstance();
    // We have to clone options for each dataset as they may get modified
    // along the way
    let res = await this.onChainDataset.updateRemoteData(Object.assign({}, transactionOptions));
    return res;
  }

  /**
   * Generates transaction data and metadata required for destroying the <record> object on network.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @return {Promise<BasePreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created <record> instance.
   */
  async _removeOnChainData (transactionOptions) {
    if (!this.onChainDataset.isDeployed()) {
      throw new SmartContractInstantiationError(`Cannot remove ${this.RECORD_TYPE}: not deployed`);
    }
    const estimate = this._deleteRecordInDirectoryFactory().estimateGas(transactionOptions);
    const data = this._deleteRecordInDirectoryFactory().encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: this.directoryContract.options.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    const eventCallbacks = {
      onReceipt: (receipt) => {
        this.onChainDataset.markObsolete();
      },
    };
    return {
      record: (this),
      transactionData: transactionData,
      eventCallbacks: eventCallbacks,
    };
  }
}

export default OnChainRecord;
