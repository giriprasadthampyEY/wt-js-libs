// @flow

import type { DataModelOptionsType } from './data-model';
import type { OffChainDataClientOptionsType } from './off-chain-data-client';
import type { AdaptedTxResultsInterface, OffChainDataAdapterInterface, WalletInterface, KeystoreV3Interface } from './interfaces/base-interfaces';
import type { WTHotelIndexInterface } from './interfaces/hotel-interfaces';
import type { WTAirlineIndexInterface } from './interfaces/airline-interfaces';
import { AbstractDataModel, AirlineDataModel, HotelDataModel } from './data-model/index';
import OffChainDataClient from './off-chain-data-client';
import { HOTEL_SEGMENT_ID } from '../test/utils/data-hotel-model-definition';
import { AIRLINE_SEGMENT_ID } from '../test/utils/data-airline-model-definition';

import {
  WTLibsError,
  SmartContractInstantiationError,
  WalletError,
  MalformedWalletError,
  WalletStateError,
  WalletPasswordError,
  WalletSigningError,
  TransactionMiningError,
  OutOfGasError,
  InsufficientFundsError,
  TransactionRevertedError,
  TransactionDidNotComeThroughError,
  NoReceiptError,
  InputDataError,
  InaccessibleEthereumNodeError,
  OffChainDataError,
  OffChainDataConfigurationError,
  OffChainDataRuntimeError,
  StoragePointerError,
  RemotelyBackedDatasetError,
  RemoteDataAccessError,
  RemoteDataReadError,
  HotelNotFoundError,
  HotelNotInstantiableError,
} from './errors';

/**
 * General options for wt-libs-js. Holds all things necessary
 * for successful setup of Winding Tree network.
 *
 * @type WtLibsOptionsType
 */
type WtLibsOptionsType = {
  segment: string,
  dataModelOptions: DataModelOptionsType,
  offChainDataOptions: OffChainDataClientOptionsType
};

/**
 * Main public interface of wt-libs-js.
 */
class WTLibs {
  static errors: Object;
  dataModel: AbstractDataModel;
  offChainDataClient: OffChainDataClient;
  options: WtLibsOptionsType;

  /**
   * Call this to create wt-libs-js instance.
   * @param options
   * @return WTLibs
   */
  static createInstance (options: WtLibsOptionsType): WTLibs {
    return new WTLibs(options);
  }

  constructor (options: WtLibsOptionsType) {
    this.options = options || {};

    if (this.options.segment === HOTEL_SEGMENT_ID) {
      this.dataModel = HotelDataModel.createInstance(this.options.dataModelOptions);
    } else if (this.options.segment === AIRLINE_SEGMENT_ID) {
      this.dataModel = AirlineDataModel.createInstance(this.options.dataModelOptions);
    } else {
      throw new Error(`Unknown segment: ${this.options.segment}`);
    }

    OffChainDataClient.setup(this.options.offChainDataOptions);
  }

  /**
   * Get an instance of Winding Tree index from the underlying `data-model`.
   *
   * @param address of the Winding Tree index
   * @type WTIndexInterface
   */
  getWTIndex (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    return this.dataModel.getWindingTreeIndex(address);
  }

  /**
   * Get a transactions status from the underlying `data-model`.
   * This method is async because it communicates directly with and EVM node.
   */
  async getTransactionsStatus (transactionHashes: Array<string>): Promise<AdaptedTxResultsInterface> {
    return this.dataModel.getTransactionsStatus(transactionHashes);
  }

  /**
   * Returns a wallet abstraction that can be used for signing transactions
   */
  createWallet (jsonWallet: KeystoreV3Interface): WalletInterface {
    return this.dataModel.createWallet(jsonWallet);
  }

  /**
   * Returns an off-chain data storage client that can be used for uploading
   * or downloading data stored off-chain.
   */
  getOffChainDataClient (schema: string): OffChainDataAdapterInterface {
    return OffChainDataClient.getAdapter(schema);
  }
}

/**
 * A map of errors that WTLibs can throw, useful
 * for checking what happened in your code.
 */
WTLibs.errors = {
  WTLibsError,
  SmartContractInstantiationError,
  WalletError,
  MalformedWalletError,
  WalletStateError,
  WalletPasswordError,
  WalletSigningError,
  TransactionMiningError,
  OutOfGasError,
  InsufficientFundsError,
  TransactionRevertedError,
  TransactionDidNotComeThroughError,
  NoReceiptError,
  InaccessibleEthereumNodeError,
  InputDataError,
  OffChainDataError,
  OffChainDataConfigurationError,
  OffChainDataRuntimeError,
  StoragePointerError,
  RemotelyBackedDatasetError,
  RemoteDataAccessError,
  RemoteDataReadError,
  HotelNotFoundError,
  HotelNotInstantiableError,
};

export default WTLibs;
