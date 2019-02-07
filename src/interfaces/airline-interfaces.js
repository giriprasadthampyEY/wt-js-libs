// @flow
import type {
  BaseOnChainDataInterface,
  TransactionCallbacksInterface,
  TransactionDataInterface, TransactionOptionsInterface,
} from './base-interfaces';

/**
 * Format of generated transaction data and metadata
 * that contains a related airline instance, transactionData
 * itself (ready for signing) and optionally eventCallbacks
 * that should be passed to our Wallet abstraction with
 * transactionData itself to ensure a consistent internal state
 * after the transaction is mined.
 */
export interface PreparedTransactionMetadataInterface {
  airline: AirlineInterface,
  transactionData: TransactionDataInterface,
  eventCallbacks?: TransactionCallbacksInterface
}

/**
 * Represents a airline instance that can
 * communicate with on-chain airline representation
 * and provides an access to offChain data via `dataIndex`
 * property.
 *
 */
export interface AirlineInterface extends BaseOnChainDataInterface {
  setLocalData(newData: AirlineInterface): Promise<void>,
  createOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  updateOnChainData(transactionOptions: TransactionOptionsInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
  removeOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  transferOnChainOwnership(newManager: string, transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>
}

/**
 * WindingTree index interface that provides all methods
 * necessary for interaction with the airlines.`
 */
export interface WTAirlineIndexInterface {
  addAirline(airline: AirlineInterface): Promise<PreparedTransactionMetadataInterface>,
  getAirline(address: string): Promise<?AirlineInterface>,
  getAllAirlines(): Promise<Array<AirlineInterface>>,
  // It is possible that this operation generates multiple transactions in the future
  updateAirline(airline: AirlineInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
  removeAirline(airline: AirlineInterface): Promise<PreparedTransactionMetadataInterface>,
  transferAirlineOwnership(airline: AirlineInterface, newManager: string): Promise<PreparedTransactionMetadataInterface>
}
