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
 * Main public interface of wt-libs-js.
 */
export class WtJsLibs {
  /**
   * Call this to create wt-libs-js instance.
   * @param options
   * @return WtJsLibs
   */
  static createInstance (options) {
    return new WtJsLibs(options);
  }

  constructor (options) {
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
  getDirectory (segment, address) {
    const dataModel = OnChainDataClient.getDataModel(segment);
    return dataModel.getDirectory(address);
  }

  /**
   * Get a transactions status from the OnChainDataClient.
   * This method is async because it communicates directly with and EVM node.
   */
  async getTransactionsStatus (transactionHashes) {
    return OnChainDataClient.getTransactionsStatus(transactionHashes);
  }

  /**
   * Returns a wallet instance for given JSON keystore.
   */
  createWallet (jsonWallet) {
    const wallet = Wallet.createInstance(jsonWallet);
    wallet.setupWeb3Eth(this.options.onChainDataOptions.provider);
    return wallet;
  }

  /**
   * Returns an off-chain data storage client that can be used for uploading
   * or downloading data stored off-chain.
   */
  getOffChainDataClient (schema) {
    return OffChainDataClient.getAdapter(schema);
  }

  /**
   * Returns a TrustClueClient instance configured with all of the clues
   * passed in the original library options.
   */
  getTrustClueClient () {
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
