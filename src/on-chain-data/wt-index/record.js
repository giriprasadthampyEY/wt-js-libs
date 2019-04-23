// @flow
import type {
  PlainDataInterface,
  BaseOnChainRecordInterface,
  TransactionCallbacksInterface,
  TransactionOptionsInterface,
  TxReceiptInterface,
} from '../../interfaces/base-interfaces';
import Utils from '../utils';
import Contracts from '../contracts';
import RemotelyBackedDataset from '../remotely-backed-dataset';
import StoragePointer from '../storage-pointer';

import { InputDataError, SmartContractInstantiationError } from '../errors';

/**
 * Wrapper class for a <record> backed by a smart contract on
 * Ethereum that's holding `dataUri` pointer to its data.
 *
 * It provides an accessor to such data in a form of
 * `StoragePointer` instance under `dataIndex` property.
 * Every schema-specific implementation details
 * are dealt with in StoragePointer.
 *
 */
class OnChainRecord {
  RECORD_TYPE: string;
  address: Promise<?string> | ?string;

  // provided by eth backed dataset
  _dataUri: Promise<?string> | ?string;
  _manager: Promise<?string> | ?string;
  _created: Promise<?string> | ?string;

  web3Utils: Utils;
  web3Contracts: Contracts;
  indexContract: Object;
  contractInstance: Object;
  onChainDataset: RemotelyBackedDataset;

  // Representation of data stored on dataUri
  _dataIndex: ?StoragePointer;
  _initialized: boolean;

  constructor (web3Utils: Utils, web3Contracts: Contracts, indexContract: Object, address?: string) {
    this.address = address;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this.indexContract = indexContract;
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
        _dataUri: {
          remoteGetter: async (): Promise<?string> => {
            return (await this._getContractInstance()).methods.dataUri().call();
          },
          remoteSetter: this._editInfoOnChain.bind(this),
        },
        _manager: {
          remoteGetter: async (): Promise<?string> => {
            return (await this._getContractInstance()).methods.manager().call();
          },
        },
        _created: {
          remoteGetter: async (): Promise<?string> => {
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

  _callRecordInContract (data: string) {
    throw new Error('Cannot call _callRecordInContract on class');
  }

  _registerRecordInContract (dataUri: ?string) {
    throw new Error('Cannot call _registerRecordInContract on class');
  }

  _transferRecordInContract (newManager: string) {
    throw new Error('Cannot call _transferRecordInContract on class');
  }

  _deleteRecordInContract () {
    throw new Error('Cannot call _deleteRecordInContract on class');
  }

  /**
   * Async getter for `StoragePointer` instance.
   * Since it has to eventually access the `dataUri`
   * field stored on-chain, it is lazy loaded.
   */
  get dataIndex (): Promise<StoragePointer> {
    return (async () => {
      if (!this._dataIndex) {
        this._dataIndex = StoragePointer.createInstance(await this.dataUri, this._getStoragePointerLayoutFactory());
      }
      return this._dataIndex;
    })();
  }

  get dataUri (): Promise<?string> | ?string {
    if (!this._initialized) {
      return;
    }
    return (async () => {
      const dataUri = await this._dataUri;
      return dataUri;
    })();
  }

  set dataUri (newDataUri: Promise<?string> | ?string) {
    if (!newDataUri) {
      throw new InputDataError(
        `Cannot update ${this.RECORD_TYPE}: Cannot set dataUri when it is not provided`
      );
    }
    if (typeof newDataUri === 'string' && !newDataUri.match(/([a-z-]+):\/\//)) {
      throw new InputDataError(
        `Cannot update ${this.RECORD_TYPE}: Cannot set dataUri with invalid format`
      );
    }
    if (newDataUri !== this._dataUri) {
      this._dataIndex = null;
    }

    this._dataUri = newDataUri;
  }

  get created (): Promise<?string> | ?string {
    if (!this._initialized) {
      return;
    }
    return (async () => {
      const created = await this._created;
      return created;
    })();
  }

  get manager (): Promise<?string> | ?string {
    if (!this._initialized) {
      return;
    }
    return (async () => {
      const manager = await this._manager;
      return manager;
    })();
  }

  set manager (newManager: Promise<?string> | ?string) {
    if (!newManager) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE}: Cannot set manager when it is not provided`);
    }
    if (this.address) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE}: Cannot set manager when ${this.RECORD_TYPE} is deployed`);
    }
    this._manager = newManager;
  }

  /**
   * Update manager and dataUri properties. dataUri can never be nulled. Manager
   * can never be nulled. Manager can be changed only for an un-deployed
   * contract (without address).
   * @param {BaseOnChainRecordInterface} newData
   */
  async setLocalData (newData: BaseOnChainRecordInterface) {
    const newManager = await newData.manager;
    if (newManager) {
      this.manager = newManager;
    }
    const newDataUri = await newData.dataUri;
    if (newDataUri) {
      this.dataUri = newDataUri;
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
  async toPlainObject (resolvedFields: ?Array<string>, depth?: number): Promise<PlainDataInterface> {
    const dataIndex = await this.dataIndex;
    const offChainData = await dataIndex.toPlainObject(resolvedFields, depth);
    let result = {
      manager: await this.manager,
      address: this.address,
      dataUri: offChainData,
    };
    return result;
  }

  async _getContractInstance (): Promise<Object> {
    if (!this.address) {
      throw new SmartContractInstantiationError(`Cannot get ${this.RECORD_TYPE} instance without address`);
    }
    if (!this.contractInstance) {
      this.contractInstance = await this._getRecordContractFactory();
    }
    return this.contractInstance;
  }

  /**
   * Generates transaction data and metadata for updating dataUri on-chain.
   * Used internally as a remoteSetter for `dataUri` property.
   * Transaction is not signed nor sent here.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<BasePreparedTransactionMetadataInterface>} resulting transaction metadata
   */
  // because flow is buggy
  // eslint-disable-next-line flowtype/require-return-type
  async _editInfoOnChain (transactionOptions: TransactionOptionsInterface) {
    const data = (await this._getContractInstance()).methods.editInfo(await this.dataUri).encodeABI();
    const estimate = this._callRecordInContract(data).estimateGas(transactionOptions);
    const txData = this._callRecordInContract(data).encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: txData,
      from: transactionOptions.from,
      to: this.indexContract.options.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    return {
      record: (this: OnChainRecord),
      transactionData: transactionData,
    };
  }

  /**
   * Generates transaction data and metadata for creating new <record> contract on-chain.
   * Transaction is not signed nor sent here.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<BasePreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created <record> instance.
   */
  // because flow is buggy
  // eslint-disable-next-line flowtype/require-return-type
  async _createOnChainData (transactionOptions: TransactionOptionsInterface) {
    const dataUri = await this.dataUri;
    const estimate = this._registerRecordInContract(dataUri).estimateGas(transactionOptions);
    const data = this._registerRecordInContract(dataUri).encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: this.indexContract.options.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    const eventCallbacks: TransactionCallbacksInterface = {
      onReceipt: (receipt: TxReceiptInterface) => {
        this.onChainDataset.markDeployed();
        if (receipt && receipt.logs) {
          let decodedLogs = this.web3Contracts.decodeLogs(receipt.logs);
          this.address = decodedLogs[0].attributes[0].value;
        }
      },
    };
    return {
      record: (this: OnChainRecord),
      transactionData: transactionData,
      eventCallbacks: eventCallbacks,
    };
  }

  /**
   * Generates transaction data and metadata required for all <record>-related data modification
   * by calling `updateRemoteData` on a `RemotelyBackedDataset`.
   *
   * @param {TransactionOptionsInterface} options object that is passed to all remote data setters
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @throws {SmartContractInstantiationError} When dataUri is empty.
   * @return {Promise<Array<BasePreparedTransactionMetadataInterface>>} List of transaction metadata
   */
  // because flow is buggy
  // eslint-disable-next-line flowtype/require-return-type
  async _updateOnChainData (transactionOptions: TransactionOptionsInterface) {
    // pre-check if contract is available at all and fail fast
    await this._getContractInstance();
    // We have to clone options for each dataset as they may get modified
    // along the way
    return this.onChainDataset.updateRemoteData(Object.assign({}, transactionOptions));
  }

  /**
   * This is potentially devastating, so it's better to name
   * this operation explicitly instead of hiding it under updateOnChainData.
   *
   * Generates transaction data and metadata required for a <record> ownership
   * transfer.
   *
   * @param {string} Address of a new manager
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @return {Promise<BasePreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created <record> instance.
   *
   */
  // because flow is buggy
  // eslint-disable-next-line flowtype/require-return-type
  async _transferOnChainOwnership (newManager: string, transactionOptions: TransactionOptionsInterface) {
    if (!this.onChainDataset.isDeployed()) {
      throw new SmartContractInstantiationError(`Cannot remove ${this.RECORD_TYPE}: not deployed`);
    }
    const estimate = this._transferRecordInContract(newManager).estimateGas(transactionOptions);
    const data = this._transferRecordInContract(newManager).encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: this.indexContract.options.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    const eventCallbacks: TransactionCallbacksInterface = {
      onReceipt: (receipt: TxReceiptInterface) => {
        this._manager = newManager;
      },
    };
    return {
      record: (this: OnChainRecord),
      transactionData: transactionData,
      eventCallbacks: eventCallbacks,
    };
  }

  /**
   * Generates transaction data and metadata required for destroying the <record> object on network.
   *
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {SmartContractInstantiationError} When the underlying contract is not yet deployed.
   * @return {Promise<BasePreparedTransactionMetadataInterface>} Transaction data and metadata, including the freshly created <record> instance.
   */
  // because flow is buggy
  // eslint-disable-next-line flowtype/require-return-type
  async _removeOnChainData (transactionOptions: TransactionOptionsInterface) {
    if (!this.onChainDataset.isDeployed()) {
      throw new SmartContractInstantiationError(`Cannot remove ${this.RECORD_TYPE}: not deployed`);
    }
    const estimate = this._deleteRecordInContract().estimateGas(transactionOptions);
    const data = this._deleteRecordInContract().encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: this.indexContract.options.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    const eventCallbacks: TransactionCallbacksInterface = {
      onReceipt: (receipt: TxReceiptInterface) => {
        this.onChainDataset.markObsolete();
      },
    };
    return {
      record: (this: OnChainRecord),
      transactionData: transactionData,
      eventCallbacks: eventCallbacks,
    };
  }
}

export default OnChainRecord;
