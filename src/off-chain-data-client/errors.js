import { WTLibsError } from '../errors';

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
