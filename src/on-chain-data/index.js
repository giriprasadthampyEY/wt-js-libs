// @flow

import type { DataModelInterface, AdaptedTxResultInterface, AdaptedTxResultsInterface, KeystoreV3Interface } from '../interfaces/base-interfaces';
import type { WTHotelIndexInterface } from '../interfaces/hotel-interfaces';
import type { WTAirlineIndexInterface } from '../interfaces/airline-interfaces';

import Utils from './utils';
import Contracts from './contracts';
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

  _wtIndexCache: {[address: string]: WTHotelIndexInterface | WTAirlineIndexInterface};

  /**
   * Sets up Utils and Contracts with given web3 provider.
   * Sets up gasCoefficient or gasMargin. If neither is provided,
   * sets gasCoefficient to a default of 2.
   */
  constructor (options: DataModelOptionsType) {
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
   * Returns an Ethereum backed Winding Tree index.
   */
  _indexFactory (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
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
   * Returns an Ethereum backed Winding Tree index.
   */
  getWindingTreeIndex (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    if (!this._wtIndexCache[address]) {
      this._wtIndexCache[address] = this._indexFactory(address);
    }
    return this._wtIndexCache[address];
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
  /**
   * Creates a configured HotelDataModel instance.
   */
  static createInstance (options: DataModelOptionsType): AbstractDataModel {
    return new HotelDataModel(options);
  }

  _indexFactory (address: string): WTHotelIndex {
    return WTHotelIndex.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

class AirlineDataModel extends AbstractDataModel {
  /**
   * Creates a configured AirlineDataModel instance.
   */
  static createInstance (options: DataModelOptionsType): AbstractDataModel {
    return new AirlineDataModel(options);
  }

  _indexFactory (address: string): WTAirlineIndex {
    return WTAirlineIndex.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export {
  HotelDataModel,
  AirlineDataModel,
  AbstractDataModel,
};
