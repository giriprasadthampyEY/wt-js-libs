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

  _getStoragePointerLayoutFactory () {
    throw new Error('Cannot call _getStoragePointerLayoutFactory on class');
  }

  _getRecordContractFactory () {
    throw new Error('Cannot call _getRecordContractFactory on class');
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

  async _hasAssociatedKey (associatedAddress, transactionOptions = {}) {
    const contract = await this._getContractInstance();
    return contract.methods.hasAssociatedKey(associatedAddress).call(transactionOptions);
  }

}

export default OnChainRecord;
