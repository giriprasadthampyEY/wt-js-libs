// @flow

import BigNumber from 'bignumber.js';

import type { WTHotelIndexInterface } from './hotel-interfaces';
import type { WTAirlineIndexInterface } from './airline-interfaces';
import StoragePointer from '../on-chain-data/storage-pointer';

/**
 * Shape of data that is stored on-chain
 * about every hotel/airline.
 *
 * - `address` is the network address.
 * - `manager` is the network address of airline manager.
 * - `dataUri` holds a pointer to the off-chain storage
 * that is used internally to store data.
 */
export interface BaseOnChainDataInterface {
  +dataIndex: Promise<StoragePointer>,
  address: Promise<?string> | ?string,
  manager: Promise<?string> | ?string,
  dataUri: Promise<?string> | ?string,

  toPlainObject(): Promise<Object>
}

export interface BasePreparedTransactionMetadataInterface {
  // TODO deal with types, flow is so bad in super/subtyping
  // eslint-disable-next-line
  airline?: any,
  // eslint-disable-next-line
  hotel?: any,
  transactionData: TransactionDataInterface,
  eventCallbacks?: TransactionCallbacksInterface
}

export interface BaseOnChainRecordInterface extends BaseOnChainDataInterface {
  setLocalData(newData: Object): Promise<void>,
  createOnChainData(transactionOptions: TransactionOptionsInterface): Promise<BasePreparedTransactionMetadataInterface>,
  updateOnChainData(transactionOptions: TransactionOptionsInterface): Promise<Array<BasePreparedTransactionMetadataInterface>>,
  removeOnChainData(transactionOptions: TransactionOptionsInterface): Promise<BasePreparedTransactionMetadataInterface>,
  transferOnChainOwnership(newManager: string, transactionOptions: TransactionOptionsInterface): Promise<BasePreparedTransactionMetadataInterface>
}

export interface PlainDataInterface {
  address: Promise<?string> | ?string,
  manager: Promise<?string> | ?string,
  dataUri: Promise<{ref: string, contents: Object}> | {ref: string, contents: Object}
}

/**
 * Ethereum transaction options that are passed from an external user.
 * It has to contain `from` and usually would contain `to` as well.
 *
 * This copies the structure of https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#contract-estimategas
 * as it might be used as a base for gas estimation prior to actually
 * sending a transaction.
 */
export interface TransactionOptionsInterface {
  from: string,
  to?: string,
  gas?: number,
  value?: number | string | BigNumber
}

/**
 * Callback options that can be passed to a transaction that
 * will be signed and sent through our Wallet abstraction.
 */
export interface TransactionCallbacksInterface {
  onReceipt?: (receipt: TxReceiptInterface) => void,
  onTransactionHash?: (hash: string) => void
}

/**
 * Formalization of AbstractDataModel's public interface.
 */
export interface DataModelInterface {
  getWindingTreeIndex(address: string): WTHotelIndexInterface | WTAirlineIndexInterface,
  getTransactionsStatus(transactionHashes: Array<string>): Promise<AdaptedTxResultsInterface>,
  createWallet(jsonWallet: Object): WalletInterface
}

/**
 * Interface for an off-chain storage read.
 */
export interface OffChainDataAdapterInterface {
  // Upload new dataset to an off-chain storage
  upload(data: {[string]: Object}): Promise<string>,
  // Change data on given uri
  update(uri: string, data: {[string]: Object}): Promise<string>,
  // Download content from given uri
  download(uri: string): Promise<?{[string]: Object}>
}

/**
 * This interface represents raw ethereum transaction log object
 * as returned by <a href="http://web3js.readthedocs.io/en/1.0/web3-eth.html#eth-getpastlogs-return">getPastLogs</a>.
 * Sometimes you might need the raw data to do some additional processing.
 */
export interface RawLogRecordInterface {
  address: string,
  data: string,
  topics: Array<string>,
  logIndex: number,
  transactionIndex: number,
  transactionHash: number,
  blockHash: number,
  blockNumber: number
}

/**
 * This interface represents an Ethereum log record
 * with decoded data that are much easier to read
 * and act upon.
 */
export interface DecodedLogRecordInterface {
  address: string,
  event: string,
  attributes: Array<{
    name: string,
    type: string,
    value: string
  }>
}

/**
 * Ethereum transaction data used when creating transaction, see for example
 * https://web3js.readthedocs.io/en/1.0/web3-eth-accounts.html#signtransaction
 */
export interface TransactionDataInterface {
  nonce?: ?number,
  chainId?: string,
  from: string,
  to: string,
  data: string,
  value?: string,
  gasPrice?: string,
  gas: string | number
}

/**
 * Ethereum transaction data after TX was accepted by the network, see
 * for example http://web3js.readthedocs.io/en/1.0/web3-eth.html#gettransaction
 */
export interface TxInterface {
  hash?: string,
  nonce?: string | number,
  blockHash?: string,
  blockNumber?: number,
  transactionIndex?: number,
  from?: string,
  to?: string,
  value?: string,
  gasPrice?: string,
  gas?: number,
  input?: string
}

/**
 * Transaction receipt as returned by
 * <a href="http://web3js.readthedocs.io/en/1.0/web3-eth.html#eth-gettransactionreceipt-return">getTransactionReceipt</a>.
 * This raw data might be sometimes needed for additional processing.
 */
export interface TxReceiptInterface {
  transactionHash: string,
  blockNumber: number,
  blockHash: string,
  transactionIndex: number,
  from: string,
  to: string,
  // For some reason ?string does not work here
  contractAddress: any, // eslint-disable-line flowtype/no-weak-types
  cumulativeGasUsed: number,
  gasUsed: number,
  logs: Array<RawLogRecordInterface>,
  // https://github.com/ethereum/EIPs/pull/658
  status: boolean
}

/**
 * A custom transaction result interface that informs
 * about the transaction status, its age and decoded logs.
 */
export interface AdaptedTxResultInterface {
  transactionHash: string,
  blockAge: number,
  decodedLogs: Array<DecodedLogRecordInterface>,
  raw: TxReceiptInterface
}

/**
 * A cummulative result of multiple transactions. We are
 * computing how many of the transactions were already
 * executed, how old are they (which might be useful for making
 * assumptions about confirmations). This also contains the raw data.
 */
export interface AdaptedTxResultsInterface {
  meta: {
    total: number,
    processed: number,
    minBlockAge: number,
    maxBlockAge: number,
    allPassed: boolean
  },
  results?: {[string]: AdaptedTxResultInterface}
}

/**
 * Wallet abstraction interface. It assumes the following workflow:
 * 1. libs user holds a json wallet
 * 2. libs user unlocks the wallet abstraction with a password
 * 3. libs user calls some business logic which internally uses `signAndSendTransaction`
 * 4. libs user either locks the wallet (if she plans to use it again)
 * 4. OR destroys the wallet object data by calling `destroy`
 *
 * `lock` should not remove the data necessary for unlocking the wallet again.
 * `destroy` on the other hand should clean all data that may be exploited from memory
 */
export interface WalletInterface {
  unlock(password: string): void,
  signAndSendTransaction(transactionData: TransactionDataInterface, eventCallBacks: TransactionCallbacksInterface): Promise<string | TxReceiptInterface>,
  lock(): void,
  destroy(): void,
  getAddress(): string
}

/**
 * Interface for Ethereum keystore
 *
 * Description: https://medium.com/@julien.m./what-is-an-ethereum-keystore-file-86c8c5917b97
 *
 * Specification: https://github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition
 */
export interface KeystoreV3Interface {
  version: number,
  id: string,
  crypto: {
    ciphertext: string,
    cipherparams: {
      iv: string
    },
    cipher: string,
    kdf: string,
    kdfparams: {
      dklen: number,
      salt: string,
      n: number,
      r: number,
      p: number
    },
    mac: string
  }
}
