// @flow

import type { OnChainDataClientOptionsType } from './on-chain-data-client';
import type { OffChainDataClientOptionsType } from './off-chain-data-client';
import type { AdaptedTxResultsInterface, OffChainDataAdapterInterface, WalletInterface, KeystoreV3Interface } from './interfaces/base-interfaces';
import type { WTHotelIndexInterface } from './interfaces/hotel-interfaces';
import type { WTAirlineIndexInterface } from './interfaces/airline-interfaces';

import { OnChainDataClient } from './on-chain-data-client';
import { OffChainDataClient } from './off-chain-data-client';
import Wallet from './wallet';

import {
  OffChainDataError,
  OffChainDataConfigurationError,
  OffChainDataRuntimeError,
} from './off-chain-data-client/errors';
import {
  InputDataError,
  StoragePointerError,
  RemotelyBackedDatasetError,
  RemoteDataAccessError,
  RemoteDataReadError,
  HotelNotFoundError,
  HotelNotInstantiableError,
  OnChainDataRuntimeError,
} from './on-chain-data-client/errors';
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
  InaccessibleEthereumNodeError,
} from './wallet/errors';

/**
 * General options for wt-libs-js. Holds all things necessary
 * for successful setup of Winding Tree network.
 *
 * @type WtJsLibsOptionsType
 */
type WtJsLibsOptionsType = {
  segment: string,
  onChainDataOptions: OnChainDataClientOptionsType,
  offChainDataOptions: OffChainDataClientOptionsType
};

/**
 * Main public interface of wt-libs-js.
 */
export class WtJsLibs {
  static errors: Object;
  options: WtJsLibsOptionsType;

  /**
   * Call this to create wt-libs-js instance.
   * @param options
   * @return WtJsLibs
   */
  static createInstance (options: WtJsLibsOptionsType): WtJsLibs {
    return new WtJsLibs(options);
  }

  constructor (options: WtJsLibsOptionsType) {
    this.options = options || {};
    OnChainDataClient.setup(this.options.onChainDataOptions);
    OffChainDataClient.setup(this.options.offChainDataOptions);
  }

  /**
   * Get an instance of Winding Tree index from the OnChainDataClient.
   *
   * @param segment - allowed are `hotels` and `airlines`
   * @param address of the Winding Tree index
   * @type WTIndexInterface
   */
  getWTIndex (segment: string, address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    const dataModel = OnChainDataClient.getDataModel(segment);
    return dataModel.getWindingTreeIndex(address);
  }

  /**
   * Get a transactions status from the OnChainDataClient.
   * This method is async because it communicates directly with and EVM node.
   */
  async getTransactionsStatus (transactionHashes: Array<string>): Promise<AdaptedTxResultsInterface> {
    return OnChainDataClient.getTransactionsStatus(transactionHashes);
  }

  /**
   * Returns a wallet instance for given JSON keystore.
   */
  createWallet (jsonWallet: KeystoreV3Interface): WalletInterface {
    const wallet = Wallet.createInstance(jsonWallet);
    wallet.setupWeb3Eth(this.options.onChainDataOptions.provider);
    return wallet;
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
 * A map of errors that WtJsLibs can throw, useful
 * for checking what happened in your code.
 */
export const errors = {
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
  OnChainDataRuntimeError,
};
