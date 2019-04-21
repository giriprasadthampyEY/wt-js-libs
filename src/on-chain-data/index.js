// @flow

import Utils from './utils';
import Contracts from './contracts';
import type { DataModelInterface, AdaptedTxResultInterface, AdaptedTxResultsInterface, KeystoreV3Interface } from '../interfaces/base-interfaces';
import Wallet from '../wallet';
import WTHotelIndex from './hotels/wt-index';
import WTAirlineIndex from './airlines/wt-index';

/**
 * DataModelOptionsType options. May look like this:
 *
 * ```
 * {
 *   "provider": 'http://localhost:8545',// or another Web3 provider
 *   "gasCoefficient": 2 // Optional, defaults to 2
 * }
 * ```
 */
export type DataModelOptionsType = {
  // URL of currently used RPC provider for Web3.
  provider: string | Object,
  // Gas coefficient that is used as a multiplier when setting
  // a transaction gas.
  gasCoefficient?: number,
  // Gas margin that is added to a computed gas amount when
  // setting a transaction gas.
  gasMargin?: number
};

/**
 * AbstractDataModel
 */
class AbstractDataModel implements DataModelInterface {
  options: DataModelOptionsType;
  web3Utils: Utils;
  web3Contracts: Contracts;

  /**
   * Returns an Ethereum backed Winding Tree index.
   */
  getWindingTreeIndex (address: string): WTHotelIndex | WTAirlineIndex {
    throw Error('Not implemented. Should be called on a subclass instance.');
  }

  /**
   * Finds out in what state are Ethereum transactions. All logs
   * are decoded along the way and some metrics such as min/max blockAge
   * are computed. If you pass all transactions related to a single
   * operation (such as updateHotel), you may benefit from the computed
   * metrics.
   */
  async getTransactionsStatus (txHashes: Array<string>): Promise<AdaptedTxResultsInterface> {
    let receiptsPromises = [];
    let txDataPromises = [];
    for (let hash of txHashes) {
      receiptsPromises.push(this.web3Utils.getTransactionReceipt(hash));
      txDataPromises.push(this.web3Utils.getTransaction(hash));
    }
    const currentBlockNumber = this.web3Utils.getCurrentBlockNumber();
    const receipts = await Promise.all(receiptsPromises);
    const txData = await Promise.all(txDataPromises);

    let results = {};
    for (let receipt of receipts) {
      if (!receipt) { continue; }
      let decodedLogs = this.web3Contracts.decodeLogs(receipt.logs);
      let originalTxData = txData.find((tx) => tx.hash === receipt.transactionHash);
      results[receipt.transactionHash] = {
        transactionHash: receipt.transactionHash,
        blockAge: (await currentBlockNumber) - receipt.blockNumber,
        decodedLogs: decodedLogs,
        from: originalTxData && originalTxData.from,
        to: originalTxData && originalTxData.to,
        raw: receipt,
      };
    }
    const resultsValues: Array<AdaptedTxResultInterface> = (Object.values(results): Array<any>); // eslint-disable-line flowtype/no-weak-types
    return {
      meta: {
        total: txHashes.length,
        processed: resultsValues.length,
        minBlockAge: Math.min(...(resultsValues.map((a) => a.blockAge))),
        maxBlockAge: Math.max(...(resultsValues.map((a) => a.blockAge))),
        // https://ethereum.stackexchange.com/questions/28077/how-do-i-detect-a-failed-transaction-after-the-byzantium-fork-as-the-revert-opco
        allPassed: (resultsValues.map((a) => a.raw.status)).every((x) => x) && txHashes.length === resultsValues.length,
      },
      results: results,
    };
  }

  /**
   * Returns a wallet instance for given JSON keystore.
   */
  createWallet (jsonWallet: KeystoreV3Interface): Wallet {
    const wallet = Wallet.createInstance(jsonWallet);
    wallet.setupWeb3Eth(this.options.provider);
    return wallet;
  }
}

class HotelDataModel extends AbstractDataModel {
  _wtIndexCache: {[address: string]: WTHotelIndex};

  /**
   * Sets up Utils and Contracts with given web3 provider.
   * Sets up gasCoefficient or gasMargin. If neither is provided,
   * sets gasCoefficient to a default of 2.
   */
  constructor (options: DataModelOptionsType) {
    super();
    this.options = options || {};
    if (!this.options.gasMargin && !this.options.gasCoefficient) {
      this.options.gasCoefficient = 2;
    }
    this.web3Utils = Utils.createInstance({
      gasCoefficient: this.options.gasCoefficient,
      gasMargin: this.options.gasMargin,
    }, this.options.provider);
    this.web3Contracts = Contracts.createInstance(this.options.provider);
    this._wtIndexCache = {};
  }

  /**
   * Creates a configured AbstractDataModel instance.
   */
  static createInstance (options: DataModelOptionsType): AbstractDataModel {
    return new HotelDataModel(options);
  }

  /**
   * Returns an Ethereum backed Winding Tree index.
   */
  getWindingTreeIndex (address: string): WTHotelIndex {
    if (!this._wtIndexCache[address]) {
      this._wtIndexCache[address] = WTHotelIndex.createInstance(address, this.web3Utils, this.web3Contracts);
    }
    return this._wtIndexCache[address];
  }
}

class AirlineDataModel extends AbstractDataModel {
  _wtIndexCache: {[address: string]: WTAirlineIndex};

  /**
   * Sets up Utils and Contracts with given web3 provider.
   * Sets up gasCoefficient or gasMargin. If neither is provided,
   * sets gasCoefficient to a default of 2.
   */
  constructor (options: DataModelOptionsType) {
    super();
    this.options = options || {};
    if (!this.options.gasMargin && !this.options.gasCoefficient) {
      this.options.gasCoefficient = 2;
    }
    this.web3Utils = Utils.createInstance({
      gasCoefficient: this.options.gasCoefficient,
      gasMargin: this.options.gasMargin,
    }, this.options.provider);
    this.web3Contracts = Contracts.createInstance(this.options.provider);
    this._wtIndexCache = {};
  }

  /**
   * Creates a configured AbstractDataModel instance.
   */
  static createInstance (options: DataModelOptionsType): AbstractDataModel {
    return new AirlineDataModel(options);
  }

  /**
   * Returns an Ethereum backed Winding Tree index.
   */
  getWindingTreeIndex (address: string): WTAirlineIndex {
    if (!this._wtIndexCache[address]) {
      this._wtIndexCache[address] = WTAirlineIndex.createInstance(address, this.web3Utils, this.web3Contracts);
    }
    return this._wtIndexCache[address];
  }
}

export {
  HotelDataModel,
  AirlineDataModel,
  AbstractDataModel,
};
