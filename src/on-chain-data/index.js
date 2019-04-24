// @flow

import type { DataModelInterface, AdaptedTxResultInterface, AdaptedTxResultsInterface } from '../interfaces/base-interfaces';
import type { WTHotelIndexInterface } from '../interfaces/hotel-interfaces';
import type { WTAirlineIndexInterface } from '../interfaces/airline-interfaces';

import { AIRLINE_SEGMENT_ID, HOTEL_SEGMENT_ID } from './constants';
import Utils from './utils';
import Contracts from './contracts';
import WTHotelIndex from './hotels/wt-index';
import WTAirlineIndex from './airlines/wt-index';
import { OnChainDataRuntimeError } from './errors';

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
export class AbstractDataModel implements DataModelInterface {
  options: DataModelOptionsType;
  web3Utils: Utils;
  web3Contracts: Contracts;

  _wtIndexCache: {[address: string]: WTHotelIndexInterface | WTAirlineIndexInterface};

  /**
   * Sets up Utils and Contracts with given web3 provider.
   * Sets up gasCoefficient or gasMargin. If neither is provided,
   * sets gasCoefficient to a default of 2.
   */
  constructor (options: DataModelOptionsType, web3Utils: Utils, web3Contracts: Contracts) {
    this.options = options || {};
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this._wtIndexCache = {};
  }

  /**
   * Returns an Ethereum backed Winding Tree index.
   */
  _indexFactory (address: string): WTHotelIndexInterface | WTAirlineIndexInterface {
    throw Error('Not implemented. Should be called on a subclass instance.');
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
}

export class HotelDataModel extends AbstractDataModel {
  /**
   * Creates a configured HotelDataModel instance.
   */
  static createInstance (options: DataModelOptionsType, web3Utils: Utils, web3Contracts: Contracts): AbstractDataModel {
    return new HotelDataModel(options, web3Utils, web3Contracts);
  }

  _indexFactory (address: string): WTHotelIndex {
    return WTHotelIndex.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export class AirlineDataModel extends AbstractDataModel {
  /**
   * Creates a configured AirlineDataModel instance.
   */
  static createInstance (options: DataModelOptionsType, web3Utils: Utils, web3Contracts: Contracts): AbstractDataModel {
    return new AirlineDataModel(options, web3Utils, web3Contracts);
  }

  _indexFactory (address: string): WTAirlineIndex {
    return WTAirlineIndex.createInstance(address, this.web3Utils, this.web3Contracts);
  }
}

export class OnChainDataClient {
  static dataModels: {[key: string]: AbstractDataModel};
  static options: DataModelOptionsType;
  static web3Utils: Utils;
  static web3Contracts: Contracts;

  static setup (options: DataModelOptionsType) {
    if (!options.gasMargin && !options.gasCoefficient) {
      options.gasCoefficient = 2;
    }
    OnChainDataClient.options = options;
    OnChainDataClient.web3Utils = Utils.createInstance({
      gasCoefficient: OnChainDataClient.options.gasCoefficient,
      gasMargin: OnChainDataClient.options.gasMargin,
    }, OnChainDataClient.options.provider);
    OnChainDataClient.web3Contracts = Contracts.createInstance(OnChainDataClient.options.provider);
  }

  static _reset () {
    OnChainDataClient.options = {};
    OnChainDataClient.dataModels = {};
  }

  static getDataModel (segment: string): AbstractDataModel {
    segment = segment && segment.toLowerCase();
    if (OnChainDataClient.dataModels[segment]) {
      return OnChainDataClient.dataModels[segment];
    }
    switch (segment) {
    case HOTEL_SEGMENT_ID:
      OnChainDataClient.dataModels[segment] = HotelDataModel.createInstance(OnChainDataClient.options, OnChainDataClient.web3Utils, OnChainDataClient.web3Contracts);
      break;
    case AIRLINE_SEGMENT_ID:
      OnChainDataClient.dataModels[segment] = AirlineDataModel.createInstance(OnChainDataClient.options, OnChainDataClient.web3Utils, OnChainDataClient.web3Contracts);
      break;
    default:
      throw new OnChainDataRuntimeError(`Unknown segment: ${segment}`);
    }
    return OnChainDataClient.dataModels[segment];
  }

  /**
   * Finds out in what state are Ethereum transactions. All logs
   * are decoded along the way and some metrics such as min/max blockAge
   * are computed. If you pass all transactions related to a single
   * operation (such as updateHotel), you may benefit from the computed
   * metrics.
   */
  static async getTransactionsStatus (txHashes: Array<string>): Promise<AdaptedTxResultsInterface> {
    let receiptsPromises = [];
    let txDataPromises = [];
    for (let hash of txHashes) {
      receiptsPromises.push(OnChainDataClient.web3Utils.getTransactionReceipt(hash));
      txDataPromises.push(OnChainDataClient.web3Utils.getTransaction(hash));
    }
    const currentBlockNumber = OnChainDataClient.web3Utils.getCurrentBlockNumber();
    const receipts = await Promise.all(receiptsPromises);
    const txData = await Promise.all(txDataPromises);

    let results = {};
    for (let receipt of receipts) {
      if (!receipt) { continue; }
      let decodedLogs = OnChainDataClient.web3Contracts.decodeLogs(receipt.logs);
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
}

export default OnChainDataClient;
