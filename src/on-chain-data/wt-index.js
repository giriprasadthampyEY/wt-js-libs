// @flow
import type { BaseOnChainRecordInterface, BasePreparedTransactionMetadataInterface } from '../interfaces/base-interfaces';
import Utils from './utils';
import Contracts from './contracts';

import { WTLibsError } from '../errors';
import { InputDataError, RecordNotFoundError, RecordNotInstantiableError } from './errors';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * index wrapper. It provides methods for working with <record>
 * contracts.
 */
class AbstractWTIndex {
  address: string;
  web3Utils: Utils;
  web3Contracts: Contracts;
  deployedIndex: Object; // TODO get rid of Object type
  RECORD_TYPE: string;

  constructor (indexAddress: string, web3Utils: Utils, web3Contracts: Contracts) {
    this.address = indexAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async _getDeployedIndexFactory (): Promise<Object> {
    throw new Error('Cannot call _getDeployedIndexFactory on the class');
  }

  async _createRecordInstanceFactory (address?: string): Promise<BaseOnChainRecordInterface> {
    throw new Error('Cannot call _createRecordInstanceFactory on the class');
  }

  async _getIndexRecordPositionFactory (address: string): Promise<number> {
    throw new Error('Cannot call _getIndexRecordPositionFactory on the class');
  }

  async _getRecordsAddressListFactory (): Promise<Array<string>> {
    throw new Error('Cannot call _getIndexRecordPositionFactory on the class');
  }

  async _getDeployedIndex (): Promise<Object> {
    if (!this.deployedIndex) {
      this.deployedIndex = await this._getDeployedIndexFactory();
    }
    return this.deployedIndex;
  }

  /**
   * Generates transaction data required for adding a totally new <record>
   * and more metadata required for sucessful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When recordData does not contain dataUri property.
   * @throws {InputDataError} When recordData does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async addRecord (recordData: BaseOnChainRecordInterface): Promise<BasePreparedTransactionMetadataInterface> {
    if (!await recordData.dataUri) {
      throw new InputDataError(`Cannot add ${this.RECORD_TYPE}: Missing dataUri`);
    }
    const recordManager = await recordData.manager;
    if (!recordManager) {
      throw new InputDataError(`Cannot add ${this.RECORD_TYPE}: Missing manager`);
    }
    const record: BaseOnChainRecordInterface = await this._createRecordInstanceFactory();
    await record.setLocalData(recordData);
    return record.createOnChainData({
      from: recordManager,
    }).catch((err) => {
      throw new WTLibsError(`Cannot add ${this.RECORD_TYPE}: ${err.message}`, err);
    });
  }

  /**
   * Generates a list of transaction data required for updating a <record>
   * and more metadata required for sucessful mining of those transactions.
   * Does not sign or send any of the transactions.
   *
   * @throws {InputDataError} When <record> does not have a manager field.
   * @throws {InputDataError} When <record> does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async updateRecord (record: BaseOnChainRecordInterface): Promise<Array<BasePreparedTransactionMetadataInterface>> {
    if (!record.address) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE} without address.`);
    }
    const recordManager = await record.manager;
    if (!recordManager) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE} without manager.`);
    }
    return record.updateOnChainData({
      from: recordManager,
    }).catch((err) => {
      throw new WTLibsError(`Cannot update ${this.RECORD_TYPE}: ${err.message}`, err);
    });
  }

  /**
   * Generates transaction data required for removing a <record>
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When <record> does not contain dataUri property.
   * @throws {InputDataError} When <record> does not contain a manager property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async removeRecord (record: BaseOnChainRecordInterface): Promise<BasePreparedTransactionMetadataInterface> {
    if (!record.address) {
      throw new InputDataError(`Cannot remove ${this.RECORD_TYPE} without address.`);
    }
    const recordManager = await record.manager;
    if (!recordManager) {
      throw new InputDataError(`Cannot remove ${this.RECORD_TYPE} without manager.`);
    }
    return record.removeOnChainData({
      from: recordManager,
    }).catch((err) => {
      // invalid opcode -> non-existent record
      // invalid opcode -> failed check for manager
      throw new WTLibsError(`Cannot remove ${this.RECORD_TYPE}: ${err.message}`, err);
    });
  }

  /**
   * Generates transaction data required for transferring a <record>
   * ownership and more metadata required for successful mining of that
   * transactoin. Does not sign or send the transaction.
   *
   * @throws {InputDataError} When record does not have an address.
   * @throws {InputDataError} When record does not contain a manager property.
   * @throws {InputDataError} When the new manager address is the same as the old manager.
   * @throws {InputDataError} When the new manager address is not a valid address.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async transferRecordOwnership (record: BaseOnChainRecordInterface, newManager: string): Promise<BasePreparedTransactionMetadataInterface> {
    if (!record.address) {
      throw new InputDataError(`Cannot transfer ${this.RECORD_TYPE} without address.`);
    }
    const recordManager = await record.manager;
    if (!recordManager) {
      throw new InputDataError(`Cannot transfer ${this.RECORD_TYPE} without manager.`);
    }

    if (recordManager.toLowerCase() === newManager.toLowerCase()) {
      throw new InputDataError(`Cannot transfer ${this.RECORD_TYPE} to the same manager.`);
    }

    if (this.web3Utils.isZeroAddress(newManager)) {
      throw new InputDataError(`Cannot transfer ${this.RECORD_TYPE} to an invalid newManager address.`);
    }

    return record.transferOnChainOwnership(newManager, {
      from: recordManager,
    }).catch((err) => {
      // invalid opcode -> non-existent record
      // invalid opcode -> failed check for manager
      throw new WTLibsError(`Cannot transfer ${this.RECORD_TYPE}: ${err.message}`, err);
    });
  }

  /**
   * Gets <record> representation of a <record> on a given address. If <record>
   * on such address is not registered through this Winding Tree index
   * instance, the method throws immediately.
   *
   * @throws {RecordNotFoundError} When <record> does not exist.
   * @throws {RecordNotInstantiableError} When the <record> class cannot be constructed.
   * @throws {WTLibsError} When something breaks in the network communication.
   */
  async getRecord (address: string): Promise<?BaseOnChainRecordInterface> {
    let recordIndex;
    try {
      // This returns strings
      recordIndex = await this._getIndexRecordPositionFactory(address);
    } catch (err) {
      throw new WTLibsError(`Cannot find ${this.RECORD_TYPE} at ${address}: ${err.message}`, err);
    }
    // Zeroeth position is reserved as empty during index deployment
    if (!recordIndex) {
      throw new RecordNotFoundError(`Cannot find ${this.RECORD_TYPE} at ${address}: Not found in ${this.RECORD_TYPE} list`);
    } else {
      return this._createRecordInstanceFactory(address).catch((err) => {
        throw new RecordNotInstantiableError(`Cannot find ${this.RECORD_TYPE} at ${address}: ${err.message}`, err);
      });
    }
  }

  /**
   * Returns a list of all <record>s. It will filter out
   * every <record> that is inaccessible for any reason.
   *
   * Currently any inaccessible <record> is silently ignored.
   * Subject to change.
   */
  async getAllRecords (): Promise<Array<BaseOnChainRecordInterface>> {
    const recordsAddressList = await this._getRecordsAddressListFactory();
    let getRecordDetails = recordsAddressList
      // Filtering null addresses beforehand improves efficiency
      .filter((addr: string): boolean => !this.web3Utils.isZeroAddress(addr))
      .map((addr: string): Promise<?BaseOnChainRecordInterface> => {
        return this.getRecord(addr) // eslint-disable-line promise/no-nesting
          // We don't really care why the <record> is inaccessible
          // and we need to catch exceptions here on each individual <record>
          .catch((err: Error): null => { // eslint-disable-line
            return null;
          });
      });
    const recordDetails: Array<?BaseOnChainRecordInterface> = await (Promise.all(getRecordDetails): any); // eslint-disable-line flowtype/no-weak-types
    const recordList: Array<BaseOnChainRecordInterface> = (recordDetails.filter((a: ?BaseOnChainRecordInterface): boolean => a != null): any); // eslint-disable-line flowtype/no-weak-types
    return recordList;
  }

  async getLifTokenAddress (): Promise<string> {
    const index = await this._getDeployedIndex();
    return index.methods.LifToken().call();
  }
}

export default AbstractWTIndex;
