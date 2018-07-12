export class WTLibsError extends Error {
  constructor (message, originalError) {
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SmartContractInstantiationError extends WTLibsError {}

export class WalletError extends WTLibsError {}

export class InputDataError extends WTLibsError {}

export class OffChainDataError extends WTLibsError {}

export class OffChainDataConfigurationError extends OffChainDataError {}

export class OffChainDataRuntimeError extends OffChainDataError {}

export class StoragePointerError extends WTLibsError {}

export class RemotelyBackedDataset extends WTLibsError {}

export class RemoteDataAccessError extends RemotelyBackedDataset {}

export class RemoteDataReadError extends RemotelyBackedDataset {}
