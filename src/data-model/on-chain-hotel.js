// @flow
import type { TransactionOptionsInterface, WalletInterface, HotelInterface, HotelOnChainDataInterface } from '../interfaces';
import type { PlainHotelInterface } from '../data-interfaces';
import Utils from '../utils';
import Contracts from '../contracts';
import RemotelyBackedDataset from '../remotely-backed-dataset';
import StoragePointer from '../storage-pointer';

/**
 * Wrapper class for a hotel backed by a smart contract on
 * Ethereum that's holding `dataUri` pointer to its data.
 *
 * It provides an accessor to such data in a form of
 * `StoragePointer` instance under `dataIndex` property.
 * Every schema-specific implementation details
 * are dealt with in StoragePointer.
 *
 */
class OnChainHotel implements HotelInterface {
  address: Promise<?string> | ?string;

  // provided by eth backed dataset
  _dataUri: Promise<?string> | ?string;
  _manager: Promise<?string> | ?string;

  web3Utils: Utils;
  web3Contracts: Contracts;
  indexContract: Object;
  contractInstance: Object;
  onChainDataset: RemotelyBackedDataset;

  // Representation of data stored on dataUri
  _dataIndex: ?StoragePointer;

  /**
   * Create new configured instance.
   * @param  {Utils} web3Utils
   * @param  {Contracts} web3Contracts
   * @param  {web3.eth.Contract} indexContract Representation of Winding Tree index
   * @param  {string} address is an optional pointer to Ethereum network where the hotel lives.
   * It is used as a reference for on-chain stored data. If it is not provided, a hotel has
   * to be created on chain to behave as expected.
   * @return {OnChainHotel}
   */
  static async createInstance (web3Utils: Utils, web3Contracts: Contracts, indexContract: Object, address?: string): Promise<OnChainHotel> {
    const hotel = new OnChainHotel(web3Utils, web3Contracts, indexContract, address);
    await hotel.initialize();
    return hotel;
  }

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
  async initialize (): Promise<void> {
    this.onChainDataset = RemotelyBackedDataset.createInstance();
    this.onChainDataset.bindProperties({
      fields: {
        _dataUri: {
          remoteGetter: async (): Promise<?string> => {
            return (await this.__getContractInstance()).methods.dataUri().call();
          },
          remoteSetter: this.__editInfoOnChain.bind(this),
        },
        _manager: {
          remoteGetter: async (): Promise<?string> => {
            return (await this.__getContractInstance()).methods.manager().call();
          },
        },
      },
    }, this);
    if (this.address) {
      this.onChainDataset.markDeployed();
    }
  }

  /**
   * Async getter for `StoragePointer` instance.
   * Since it has to eventually access the `dataUri`
   * field stored on-chain, it is lazy loaded.
   * Any data structure that is accessed by StoragePointer
   * instance has for now be known beforehand, thus the whole
   * data format of hotel data on `dataUri` is specified here.
   *
   */
  get dataIndex (): Promise<StoragePointer> {
    return (async () => {
      if (!this._dataIndex) {
        this._dataIndex = StoragePointer.createInstance(await this.dataUri, [
          {
            name: 'descriptionUri',
            isStoragePointer: true,
            // This should always be in line with publicly declared HotelDescriptionInterface
            fields: [
              'location',
              'name',
              'description',
              'roomTypes',
              'contacts',
              'address',
              'timezone',
              'currency',
              'images',
              'amenities',
              'updatedAt',
            ],
          },
        ]);
      }
      return this._dataIndex;
    })();
  }

  get dataUri (): Promise<?string> | ?string {
    if (!this._dataUri) {
      return;
    }

    return (async () => {
      const dataUri = await this._dataUri;
      return dataUri;
    })();
  }

  set dataUri (newDataUri: Promise<?string> | ?string) {
    if (!newDataUri) {
      throw new Error(
        'Cannot update hotel: Cannot set dataUri when it is not provided'
      );
    }
    if (typeof newDataUri === 'string' && !newDataUri.match(/([a-z-]+):\/\//)) {
      throw new Error(
        'Cannot update hotel: Cannot set dataUri with invalid format'
      );
    }
    if (newDataUri !== this._dataUri) {
      this._dataIndex = null;
    }

    this._dataUri = newDataUri;
  }

  get manager (): Promise<?string> | ?string {
    if (!this._manager) {
      return;
    }

    return (async () => {
      const manager = await this._manager;
      return manager;
    })();
  }

  set manager (newManager: Promise<?string> | ?string) {
    if (!newManager) {
      throw new Error('Cannot update hotel: Cannot set manager to null');
    }
    if (this.address) {
      throw new Error('Cannot update hotel: Cannot set manager when hotel is deployed');
    }
    this._manager = newManager;
  }

  /**
   * Update manager and dataUri properties. dataUri can never be nulled. Manager
   * can never be nulled. Manager can be changed only for an un-deployed
   * contract (without address).
   * @param {HotelOnChainDataInterface} newData
   */
  async setLocalData (newData: HotelOnChainDataInterface): Promise<void> {
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
   * Helper method that transforms the whole hotel into a sync simple
   * JavaScript object only with data properties.
   *
   * By default, all off-chain data is resolved recurisvely. If you want to
   * limit off-chain data only to a certain subtree, use the resolvedFields
   * parameter that accepts an array of paths in dot notation (`father.son.child`).
   * Every last piece of every path will be resolved recursively as well.
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
   * @param {resolvedFields} List of fields to be resolved from off chain data, in dot notation.
   */
  async toPlainObject (resolvedFields: ?Array<string>): Promise<PlainHotelInterface> {
    const dataIndex = (await this.dataIndex);
    const offChainData = await dataIndex.toPlainObject(resolvedFields);
    let result = {
      manager: await this.manager,
      address: this.address,
      dataUri: offChainData,
    };
    return result;
  }

  async __getContractInstance (): Promise<Object> {
    if (!this.address) {
      throw new Error('Cannot get hotel instance without address');
    }
    if (!this.contractInstance) {
      this.contractInstance = await this.web3Contracts.getHotelInstance(this.address, this.web3Utils.getCurrentWeb3Provider());
    }
    return this.contractInstance;
  }

  /**
   * Updates dataUri on-chain. Used internally as a remoteSetter for `dataUri` property.
   *
   * @param {WalletInterface} wallet that signs the transaction
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<string>} resulting transaction hash
   */
  async __editInfoOnChain (wallet: WalletInterface, transactionOptions: TransactionOptionsInterface): Promise<string> {
    const data = (await this.__getContractInstance()).methods.editInfo(await this.dataUri).encodeABI();
    const estimate = await this.indexContract.methods.callHotel(this.address, data).estimateGas(transactionOptions);
    const txData = this.indexContract.methods.callHotel(this.address, data).encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: txData,
      from: transactionOptions.from,
      to: this.indexContract.options.address,
      gas: this.web3Utils.applyGasCoefficient(estimate),
    };
    return wallet.signAndSendTransaction(transactionData)
      .then((hash) => {
        return hash;
      })
      .catch((err) => {
        throw new Error('Cannot update hotel: ' + err);
      });
  }

  /**
   * Creates new hotel contract on-chain.
   *
   * Precomputes the deployed hotel on-chain address, so even if
   * the resulting transaction is not yet mined, the address is already known.
   *
   * Returns once the transaction is signed and sent to network by `wallet`.
   *
   * @param {WalletInterface} wallet that signs the transaction
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @return {Promise<Array<string>>} list of resulting transaction hashes
   */
  async createOnChainData (wallet: WalletInterface, transactionOptions: TransactionOptionsInterface): Promise<Array<string>> {
    // Pre-compute hotel address, we need to use index for it's creating the contract
    this.address = this.web3Utils.determineDeployedContractFutureAddress(
      this.indexContract.options.address,
      await this.web3Utils.determineCurrentAddressNonce(this.indexContract.options.address)
    );
    // Create hotel on-network
    const dataUri = await this.dataUri;
    const estimate = await this.indexContract.methods.registerHotel(dataUri).estimateGas(transactionOptions);
    const data = this.indexContract.methods.registerHotel(dataUri).encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: this.indexContract.options.address,
      gas: this.web3Utils.applyGasCoefficient(estimate),
    };
    return wallet.signAndSendTransaction(transactionData, () => {
      this.onChainDataset.markDeployed();
    })
      .then((hash) => {
        return [hash];
      })
      .catch((err) => {
        throw new Error('Cannot create hotel: ' + err);
      });
  }

  /**
   * Updates all hotel-related data by calling `updateRemoteData` on a `RemotelyBackedDataset`
   * dataset.
   *
   * @param {WalletInterface} wallet that signs the transaction
   * @param {TransactionOptionsInterface} options object that is passed to all remote data setters
   * @throws {Error} When the underlying contract is not yet deployed.
   * @throws {Error} When dataUri is empty.
   * @return {Promise<Array<string>>} List of transaction hashes
   */
  async updateOnChainData (wallet: WalletInterface, transactionOptions: TransactionOptionsInterface): Promise<Array<string>> {
    // pre-check if contract is available at all and fail fast
    await this.__getContractInstance();
    // We have to clone options for each dataset as they may get modified
    // along the way
    return this.onChainDataset.updateRemoteData(wallet, Object.assign({}, transactionOptions));
  }

  /**
   * Destroys the object on network, in this case, calls a `deleteHotel` on
   * Winding Tree index contract.
   *
   * @param {WalletInterface} wallet that signs the transaction
   * @param {TransactionOptionsInterface} options object, only `from` property is currently used, all others are ignored in this implementation
   * @throws {Error} When the underlying contract is not yet deployed.
   * @return {Promise<Array<string>>} List of transaction hashes
   */
  async removeOnChainData (wallet: WalletInterface, transactionOptions: TransactionOptionsInterface): Promise<Array<string>> {
    if (!this.onChainDataset.isDeployed()) {
      throw new Error('Cannot remove hotel: not deployed');
    }
    const estimate = await this.indexContract.methods.deleteHotel(this.address).estimateGas(transactionOptions);
    const data = this.indexContract.methods.deleteHotel(this.address).encodeABI();
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(transactionOptions.from),
      data: data,
      from: transactionOptions.from,
      to: this.indexContract.options.address,
      gas: this.web3Utils.applyGasCoefficient(estimate),
    };
    return wallet.signAndSendTransaction(transactionData, () => {
      this.onChainDataset.markObsolete();
    })
      .then((hash) => {
        return [hash];
      })
      .catch((err) => {
        throw new Error('Cannot remove hotel: ' + err);
      });
  }
}

export default OnChainHotel;
