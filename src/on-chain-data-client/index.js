// @flow

import type { AdaptedTxResultInterface, AdaptedTxResultsInterface } from '../interfaces/base-interfaces';
import type { DataModelOptionsType } from './abstract-data-model';

import { AIRLINE_SEGMENT_ID, HOTEL_SEGMENT_ID } from './constants';
import Utils from './utils';
import Contracts from './contracts';
import HotelDataModel from './hotels/data-model';
import AirlineDataModel from './airlines/data-model';
import { OnChainDataRuntimeError } from './errors';
import { AbstractDataModel } from './abstract-data-model';

export class OnChainDataClient {
  static dataModels: {[key: string]: AbstractDataModel};
  static options: DataModelOptionsType;
  static web3Utils: Utils;
  static web3Contracts: Contracts;

  static setup (options: DataModelOptionsType) {
    options = options || {};
    if (!options.gasMargin && !options.gasCoefficient) {
      options.gasCoefficient = 2;
    }
    OnChainDataClient.dataModels = {};
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
