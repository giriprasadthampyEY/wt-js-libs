import { WTLibsError } from '../errors';

export class OnChainDataRuntimeError extends WTLibsError {}

/**
 * A smart contract abstraction could not have been created.
 */
export class SmartContractInstantiationError extends WTLibsError {}

/**
 * Input data has a wrong format or some data is missing.
 */
export class InputDataError extends WTLibsError {}

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

/**
 * Organization is not found in WTIndex for some reason.
 */
export class OrganizationNotFoundError extends WTLibsError {}

/**
 * Organization abstraction instance cannot be created for some reason.
 */
export class OrganizationNotInstantiableError extends WTLibsError {}
