// @flow

import type { OnChainDataClientOptionsType } from './on-chain-data-client';
import type { OffChainDataClientOptionsType } from './off-chain-data-client';
import type { TrustClueClientOptionsType } from './trust-clue-client';
import type { AdaptedTxResultsInterface, OffChainDataAdapterInterface, WalletInterface, KeystoreV3Interface } from './interfaces/base-interfaces';
import type { HotelDirectoryInterface } from './interfaces/hotel-interfaces';
import type { AirlineDirectoryInterface } from './interfaces/airline-interfaces';

import { OnChainDataClient } from './on-chain-data-client';
import StoragePointer from './on-chain-data-client/storage-pointer';
import { OffChainDataClient } from './off-chain-data-client';
import { TrustClueClient } from './trust-clue-client';
import Wallet from './wallet';

import {
  WTLibsError,
} from './errors';
import {
  OffChainDataError,
  OffChainDataConfigurationError,
  OffChainDataRuntimeError,
} from './off-chain-data-client/errors';
import {
  TrustClueError,
  TrustClueConfigurationError,
  TrustClueRuntimeError,
} from './trust-clue-client/errors';
import {
  InputDataError,
  StoragePointerError,
  RemotelyBackedDatasetError,
  RemoteDataAccessError,
  RemoteDataReadError,
  HotelNotFoundError,
  HotelNotInstantiableError,
  OnChainDataRuntimeError,
  SmartContractInstantiationError,
} from './on-chain-data-client/errors';
import {
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
  offChainDataOptions: OffChainDataClientOptionsType,
  trustClueOptions: TrustClueClientOptionsType
};

/**
 * Main public interface of wt-libs-js.
 */
export class WtJsLibs {
  static errors: Object;
  options: WtJsLibsOptionsType;
  trustClueClient: TrustClueClient;

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
   * @type HotelDirectoryInterface | AirlineDirectoryInterface
   */
  getDirectory (segment: string, address: string): HotelDirectoryInterface | AirlineDirectoryInterface {
    // TODO use Entrypoint
    const dataModel = OnChainDataClient.getDataModel(segment);
    return dataModel.getDirectory(address);
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

  /**
   * Returns a TrustClueClient instance configured with all of the clues
   * passed in the original library options.
   */
  getTrustClueClient (): TrustClueClient {
    if (!this.trustClueClient) {
      this.trustClueClient = TrustClueClient.createInstance(this.options.trustClueOptions);
    }
    return this.trustClueClient;
  }
}

/**
 * A map of errors that WtJsLibs can throw, useful
 * for checking what happened in your code.
 */
export const errors = {
  WTLibsError,
  OffChainDataError,
  OffChainDataConfigurationError,
  OffChainDataRuntimeError,
  TrustClueError,
  TrustClueConfigurationError,
  TrustClueRuntimeError,
  InputDataError,
  StoragePointerError,
  RemotelyBackedDatasetError,
  RemoteDataAccessError,
  RemoteDataReadError,
  HotelNotFoundError,
  HotelNotInstantiableError,
  OnChainDataRuntimeError,
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
};

/**
 * Export important classes for convenience.
 */
export {
  OffChainDataClient,
  OnChainDataClient,
  TrustClueClient,
  StoragePointer,
  Wallet,
};
