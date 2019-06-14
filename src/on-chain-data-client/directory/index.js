import { WTLibsError } from '../../errors';
import { InputDataError, RecordNotFoundError, RecordNotInstantiableError } from '../errors';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * index wrapper. It provides methods for working with <record>
 * contracts.
 *
 * This should be extended by particular data types, such as hotels,
 * airlines, OTAs etc.
 */
class AbstractDirectory {
  constructor (indexAddress, web3Utils, web3Contracts) {
    this.address = indexAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async _getDeployedDirectoryFactory () {
    throw new Error('Cannot call _getDeployedDirectoryFactory on the class');
  }

  async _createRecordInstanceFactory (address) {
    throw new Error('Cannot call _createRecordInstanceFactory on the class');
  }

  async _getDirectoryRecordPositionFactory (address) {
    throw new Error('Cannot call _getDirectoryRecordPositionFactory on the class');
  }

  async _getDirectoryRecordByPositionFactory (idx) {
    throw new Error('Cannot call _getDirectoryRecordByPositionFactory on the class');
  }

  async _getRecordsAddressListFactory () {
    throw new Error('Cannot call _getRecordsAddressListFactory on the class');
  }

  async _getSegmentFactory (transactionOptions) {
    throw new Error('Cannot call _getSegmentFactory on the class');
  }

  async _getDeployedDirectory () {
    if (!this.deployedDirectory) {
      this.deployedDirectory = await this._getDeployedDirectoryFactory();
    }
    return this.deployedDirectory;
  }

  async _getSegment (transactionOptions) {
    return this._getSegmentFactory(transactionOptions);
  }

  /**
   * Generates transaction data required for adding a totally new <recordData>
   * and more metadata required for sucessful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When recordData does not contain orgJsonUri property.
   * @throws {InputDataError} When recordData does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async _addRecord (recordData) {
    if (!recordData.address) {
      throw new InputDataError(`Cannot add ${this.RECORD_TYPE} without address.`);
    }
    const owner = await recordData.owner;
    if (!owner) {
      throw new InputDataError(`Cannot add ${this.RECORD_TYPE} without owner.`);
    }
    const directory = await this._getDeployedDirectory();
    const data = directory.methods.add(recordData.address).encodeABI();
    const estimate = directory.methods.add(recordData.address).estimateGas({ from: owner });
    const transactionData = {
      nonce: await this.web3Utils.determineCurrentAddressNonce(owner),
      data: data,
      from: owner,
      to: this.address,
      gas: this.web3Utils.applyGasModifier(await estimate),
    };
    return {
      record: this,
      transactionData: transactionData,
    };
  }

  async _createRecord (recordData, alsoAdd = false) {
    const orgJsonUri = await recordData.orgJsonUri;
    if (!orgJsonUri) {
      throw new InputDataError(`Cannot create ${this.RECORD_TYPE}: Missing orgJsonUri`);
    }
    const recordOwner = await recordData.owner;
    if (!recordOwner) {
      throw new InputDataError(`Cannot create ${this.RECORD_TYPE}: Missing owner`);
    }
    let record;
    try {
      record = await this._createRecordInstanceFactory();
    } catch (err) {
      throw new RecordNotInstantiableError(`Cannot create ${this.RECORD_TYPE}: ${err.message}`, err);
    }
    record.orgJsonUri = orgJsonUri;
    return record.createOnChainData({
      from: recordOwner,
    }, alsoAdd).catch((err) => {
      throw new WTLibsError(`Cannot create ${this.RECORD_TYPE}: ${err.message}`, err);
    });
  }

  /**
   * Generates a list of transaction data required for updating a <record>
   * and more metadata required for sucessful mining of those transactions.
   * Does not sign or send any of the transactions.
   *
   * @throws {InputDataError} When <record> does not have a owner field.
   * @throws {InputDataError} When <record> does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async _updateRecord (record) {
    if (!record.address) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE} without address.`);
    }
    const recordOwner = await record.owner;
    if (!recordOwner) {
      throw new InputDataError(`Cannot update ${this.RECORD_TYPE} without owner.`);
    }
    return record.updateOnChainData({
      from: recordOwner,
    }).catch((err) => {
      throw new WTLibsError(`Cannot update ${this.RECORD_TYPE}: ${err.message}`, err);
    });
  }

  /**
   * Generates transaction data required for removing a <record>
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When <record> does not contain orgJsonUri property.
   * @throws {InputDataError} When <record> does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async _removeRecord (record) {
    if (!record.address) {
      throw new InputDataError(`Cannot remove ${this.RECORD_TYPE} without address.`);
    }
    const recordOwner = await record.owner;
    if (!recordOwner) {
      throw new InputDataError(`Cannot remove ${this.RECORD_TYPE} without owner.`);
    }
    return record.removeOnChainData({
      from: recordOwner,
    }).catch((err) => {
      // invalid opcode -> non-existent record
      // invalid opcode -> failed check for owner
      throw new WTLibsError(`Cannot remove ${this.RECORD_TYPE}: ${err.message}`, err);
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
  async _getRecord (address) {
    let recordIndex;
    try {
      // This returns strings
      recordIndex = await this._getDirectoryRecordPositionFactory(address);
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

  async _getRecordIndex (address) {
    return this._getDirectoryRecordPositionFactory(address);
  }

  async _getRecordByIndex (recordIndex) {
    const address = await this._getDirectoryRecordByPositionFactory(recordIndex);
    return this._getRecord(address);
  }

  /**
   * Returns a list of all <record>s. It will filter out
   * every <record> that is inaccessible for any reason.
   *
   * Currently any inaccessible <record> is silently ignored.
   * Subject to change.
   */
  async _getRecords () {
    const recordsAddressList = await this._getRecordsAddressListFactory();
    let getRecordDetails = recordsAddressList
      // Filtering null addresses beforehand improves efficiency
      .filter((addr) => !this.web3Utils.isZeroAddress(addr))
      .map((addr) => {
        return this._getRecord(addr) // eslint-disable-line promise/no-nesting
          // We don't really care why the <record> is inaccessible
          // and we need to catch exceptions here on each individual <record>
          .catch((err) => { // eslint-disable-line
            return null;
          });
      });
    const recordDetails = await (Promise.all(getRecordDetails));
    const recordList = (recordDetails.filter(a => a != null));
    return recordList;
  }

  async getLifTokenAddress () {
    const index = await this._getDeployedDirectory();
    return index.methods.LifToken().call();
  }
}

export default AbstractDirectory;
