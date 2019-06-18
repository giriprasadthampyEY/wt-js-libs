import { WTLibsError } from '../../errors';
import { InputDataError, RecordNotFoundError, RecordNotInstantiableError } from '../errors';
import OnChainOrganization from './organization';

class SegmentDirectory {
  constructor (indexAddress, web3Utils, web3Contracts) {
    this.address = indexAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async _getDeployedDirectoryFactory () {
    return this.web3Contracts.getSegmentDirectoryInstance(this.address);
  }

  async _createRecordInstanceFactory (address) {
    return OnChainOrganization.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedDirectory(), address);
  }

  async _getDirectoryRecordPositionFactory (address) {
    const directory = await this._getDeployedDirectory();
    return parseInt(await directory.methods.organizationsIndex(address).call(), 10);
  }

  async _getDirectoryRecordByPositionFactory (idx) {
    const directory = await this._getDeployedDirectory();
    return directory.methods.organizations(idx).call();
  }

  async _getRecordsAddressListFactory () {
    const directory = await this._getDeployedDirectory();
    return directory.methods.getOrganizations().call();
  }

  async _getSegmentFactory (transactionOptions) {
    const directory = await this._getDeployedDirectory();
    return directory.methods.getSegment().call(transactionOptions);
  }

  async _getDeployedDirectory () {
    if (!this.deployedDirectory) {
      this.deployedDirectory = await this._getDeployedDirectoryFactory();
    }
    return this.deployedDirectory;
  }

  async getSegment (transactionOptions) {
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
  async add (recordData) {
    if (!recordData.address) {
      throw new InputDataError('Cannot add Organization without address.');
    }
    const owner = await recordData.owner;
    if (!owner) {
      throw new InputDataError('Cannot add Organization without owner.');
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

  /**
   * Generates transaction data required for removing a <record>
   * and more metadata required for successful mining of that transaction.
   * Does not sign or send the transaction.
   *
   * @throws {InputDataError} When <record> does not contain orgJsonUri property.
   * @throws {InputDataError} When <record> does not contain a owner property.
   * @throws {WTLibsError} When anything goes wrong during data preparation phase.
   */
  async remove (record) {
    if (!record.address) {
      throw new InputDataError('Cannot remove Organization without address.');
    }
    const recordOwner = await record.owner;
    if (!recordOwner) {
      throw new InputDataError('Cannot remove Organization without owner.');
    }
    return record.removeOnChainData({
      from: recordOwner,
    }).catch((err) => {
      // invalid opcode -> non-existent record
      // invalid opcode -> failed check for owner
      throw new WTLibsError(`Cannot remove Organization: ${err.message}`, err);
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
      throw new WTLibsError(`Cannot find Organization at ${address}: ${err.message}`, err);
    }
    // Zeroeth position is reserved as empty during index deployment
    if (!recordIndex) {
      throw new RecordNotFoundError(`Cannot find Organization at ${address}: Not found in Organization list`);
    } else {
      return this._createRecordInstanceFactory(address).catch((err) => {
        throw new RecordNotInstantiableError(`Cannot find Organization at ${address}: ${err.message}`, err);
      });
    }
  }

  async getRecordIndex (address) {
    return this._getDirectoryRecordPositionFactory(address);
  }

  async getRecordByIndex (recordIndex) {
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
  async getRecords () {
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

export default SegmentDirectory;
