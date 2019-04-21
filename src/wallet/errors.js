import { WTLibsError } from '../errors';

/**
 * Some error occurred in the wallet abstraction.
 */
export class WalletError extends WTLibsError {}

/**
 * Thrown when a wallet cannot be decrypted by web3 due to its format
 * or bad parameters.
 */
export class MalformedWalletError extends WalletError {}

/**
 * Thrown when an operation is performed with a wallet
 * that can not be currently done due to its internal state.
 */
export class WalletStateError extends WalletError {}

/**
 * Wallet cannot be decrypted because of a bad password.
 */
export class WalletPasswordError extends WalletError {}

/**
 * Error occured during signing a transaction, that might
 * mean that the wallet can't sign the transaction data,
 * because tx.from does not match the wallet's address.
 */
export class WalletSigningError extends WalletError {}

/**
 * Generic error that happens when no special case is
 * detected during transaction mining error throw by web3.js
 */
export class TransactionMiningError extends WTLibsError {}

/**
 * Transaction supposedly ran out of gas and was not mined.
 * This depends on how precisely the error is reported by EVM
 * and subsequently web3.js
 */
export class OutOfGasError extends TransactionMiningError {}

/**
 * Transaction supposedly was not mined because the originating
 * account does not have enough funds.
 * This depends on how precisely the error is reported by EVM
 * and subsequently web3.js
 */
export class InsufficientFundsError extends TransactionMiningError {}

/**
 * Transaction was supposedly reverted and was not mined.
 * This depends on how precisely the error is reported by EVM
 * and subsequently web3.js
 */
export class TransactionRevertedError extends TransactionMiningError {}

/**
 * Transaction did not go into mining at all. It might be due to
 * an existing transaction with the same ID or because you tried
 * to replace an existing transaction with less gas.
 */
export class TransactionDidNotComeThroughError extends TransactionMiningError {}

/**
 * There was a problem with getting a transaction receipt (network issue,
 * timeout, small gasPrice). It does not necessarily mean that the
 * transaction was not mined. You should probably check for it by other means.
 * This depends on how precisely the error is reported by EVM
 * and subsequently web3.js
 */
export class NoReceiptError extends TransactionMiningError {}

/**
 * There was a problem with communicating with the Ethereum node.
 * The library has literally zero idea about what really happened with the
 * transaction.
 */
export class InaccessibleEthereumNodeError extends TransactionMiningError {}
