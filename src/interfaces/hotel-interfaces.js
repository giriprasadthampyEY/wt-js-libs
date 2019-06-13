// @flow
import type {
  BasePreparedTransactionMetadataInterface,
  BaseOnChainRecordInterface,
  TransactionOptionsInterface,
} from './base-interfaces';

/**
 * Format of generated transaction data and metadata
 * that contains a related hotel instance, transactionData
 * itself (ready for signing) and optionally eventCallbacks
 * that should be passed to our Wallet abstraction with
 * transactionData itself to ensure a consistent internal state
 * after the transaction is mined.
 */
export interface PreparedTransactionMetadataInterface extends BasePreparedTransactionMetadataInterface {
  // hotel: HotelInterface,
}

/**
 * Represents a hotel instance that can
 * communicate with on-chain hotel representation
 * and provides an access to offChain data via `dataIndex`
 * property.
 *
 */
export interface HotelInterface extends BaseOnChainRecordInterface {
  setLocalData(newData: HotelInterface): Promise<void>,
  createOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  updateOnChainData(transactionOptions: TransactionOptionsInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
  removeOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  transferOnChainOwnership(newOwner: string, transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>
}

// /**
//  * WindingTree index interface that provides all methods
//  * necessary for interaction with the hotels.`
//  */
// export interface HotelDirectoryInterface {
//   add(hotel: HotelInterface): Promise<PreparedTransactionMetadataInterface>,
//   getOrganization(address: string): Promise<?HotelInterface>,
//   getOrganizations(): Promise<Array<HotelInterface>>,
//   // It is possible that this operation generates multiple transactions in the future
//   update(hotel: HotelInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
//   remove(hotel: HotelInterface): Promise<PreparedTransactionMetadataInterface>,
//   transferOwnership(hotel: HotelInterface, newOwner: string): Promise<PreparedTransactionMetadataInterface>
// }

/**
 * WindingTree directory interface that provides all methods
 * necessary for interaction with the hotels.`
 */
export interface HotelDirectoryInterface {
   create(hotel: HotelInterface): string,
   createAndAdd(hotel: HotelInterface): string,
   add(hotel: HotelInterface): string,
   remove(hotel: HotelInterface): void,
   getOrganizationsLength(): number,
   getOrganizations(): string[],
   organizationsIndex(hotel: string): number,
   hotels(index: number): HotelInterface
}
