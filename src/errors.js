/**
 * Generic WT Libs error.
 */
export class WTLibsError extends Error {
  constructor (message, originalError) {
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * A smart contract abstraction could not have been created.
 */
export class SmartContractInstantiationError extends WTLibsError {}

/**
 * Some error occurred in the wallet abstraction.
 */
export class WalletError extends WTLibsError {}

/**
 * Input data has a wrong format or some data is missing.
 */
export class InputDataError extends WTLibsError {}

/**
 * Generic error related to off-chain stored data.
 */
export class OffChainDataError extends WTLibsError {}

/**
 * An error occurred during a configuration of off-chain data storages.
 */
export class OffChainDataConfigurationError extends OffChainDataError {}

/**
 * An error occurred during an attempt to use off-chain data storage.
 */
export class OffChainDataRuntimeError extends OffChainDataError {}

/**
 * An error occurred when working with a StoragePointer.
 */
export class StoragePointerError extends WTLibsError {}

/**
 * Generic error that occurrs during any work with RemotelyBackedDataset.
 */
export class RemotelyBackedDatasetError extends WTLibsError {}

/**
 * It is impossible to access remote data (i. e. the data is in bad state).
 */
export class RemoteDataAccessError extends RemotelyBackedDatasetError {}

/**
 * It is impossible to read from remote data (i. e. the connection might have been lost).
 */
export class RemoteDataReadError extends RemotelyBackedDatasetError {}
