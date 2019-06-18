class OrganizationFactory {
  static createInstance (factoryAddress, web3Utils, web3Contracts) {
    return new OrganizationFactory(factoryAddress, web3Utils, web3Contracts);
  }

  constructor (indexAddress, web3Utils, web3Contracts) {
    this.address = indexAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async createRecord (recordData) {
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
    }).catch((err) => {
      throw new WTLibsError(`Cannot create ${this.RECORD_TYPE}: ${err.message}`, err);
    });
  }
}