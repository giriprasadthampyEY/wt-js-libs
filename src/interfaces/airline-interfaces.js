// @flow
import type {
  BasePreparedTransactionMetadataInterface,
  BaseOnChainRecordInterface,
  TransactionOptionsInterface,
} from './base-interfaces';

/**
 * Format of generated transaction data and metadata
 * that contains a related airline instance, transactionData
 * itself (ready for signing) and optionally eventCallbacks
 * that should be passed to our Wallet abstraction with
 * transactionData itself to ensure a consistent internal state
 * after the transaction is mined.
 */
export interface PreparedTransactionMetadataInterface extends BasePreparedTransactionMetadataInterface {
  // airline: AirlineInterface,
}

/**
 * Represents a airline instance that can
 * communicate with on-chain airline representation
 * and provides an access to offChain data via `dataIndex`
 * property.
 *
 */
export interface AirlineInterface extends BaseOnChainRecordInterface { // TODO remove airline/hotel interfaces?
  setLocalData(newData: AirlineInterface): Promise<void>,
  createOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  updateOnChainData(transactionOptions: TransactionOptionsInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
  removeOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  transferOnChainOwnership(newOwner: string, transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>
}

// /**
//  * WindingTree index interface that provides all methods
//  * necessary for interaction with the airlines.`
//  */
// export interface AirlineDirectoryInterface {
//   add(airline: AirlineInterface): Promise<PreparedTransactionMetadataInterface>,
//   getOrganization(address: string): Promise<?AirlineInterface>,
//   getOrganizations(): Promise<Array<AirlineInterface>>,
//   // It is possible that this operation generates multiple transactions in the future
//   update(airline: AirlineInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
//   remove(airline: AirlineInterface): Promise<PreparedTransactionMetadataInterface>,
//   transferOwnership(airline: AirlineInterface, newOwner: string): Promise<PreparedTransactionMetadataInterface>
// }

/**
 * WindingTree directory interface that provides all methods
 * necessary for interaction with the airlines.`
 */
export interface AirlineDirectoryInterface {
   create(orgJsonUri: string): string,
   createAndAdd(orgJsonUri: string): string,
   add(airline: string): string,
   remove(airline: string): void,
   getOrganizationsLength(): number,
   getOrganizations(): string[],
   organizationsIndex(airline: string): number,
   organizations(index: number): string
}
