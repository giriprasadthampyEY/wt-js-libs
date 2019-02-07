// @flow
import type {
  BaseOnChainDataInterface,
  TransactionCallbacksInterface,
  TransactionDataInterface, TransactionOptionsInterface,
} from './base-interfaces';

/**
 * Format of generated transaction data and metadata
 * that contains a related hotel instance, transactionData
 * itself (ready for signing) and optionally eventCallbacks
 * that should be passed to our Wallet abstraction with
 * transactionData itself to ensure a consistent internal state
 * after the transaction is mined.
 */
export interface PreparedTransactionMetadataInterface {
  hotel: HotelInterface,
  transactionData: TransactionDataInterface,
  eventCallbacks?: TransactionCallbacksInterface
}

/**
 * Represents a hotel instance that can
 * communicate with on-chain hotel representation
 * and provides an access to offChain data via `dataIndex`
 * property.
 *
 */
export interface HotelInterface extends BaseOnChainDataInterface {
  setLocalData(newData: HotelInterface): Promise<void>,
  createOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  updateOnChainData(transactionOptions: TransactionOptionsInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
  removeOnChainData(transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>,
  transferOnChainOwnership(newManager: string, transactionOptions: TransactionOptionsInterface): Promise<PreparedTransactionMetadataInterface>
}

/**
 * WindingTree index interface that provides all methods
 * necessary for interaction with the hotels.`
 */
export interface WTHotelIndexInterface {
  addHotel(hotel: HotelInterface): Promise<PreparedTransactionMetadataInterface>,
  getHotel(address: string): Promise<?HotelInterface>,
  getAllHotels(): Promise<Array<HotelInterface>>,
  // It is possible that this operation generates multiple transactions in the future
  updateHotel(hotel: HotelInterface): Promise<Array<PreparedTransactionMetadataInterface>>,
  removeHotel(hotel: HotelInterface): Promise<PreparedTransactionMetadataInterface>,
  transferHotelOwnership(hotel: HotelInterface, newManager: string): Promise<PreparedTransactionMetadataInterface>
}
