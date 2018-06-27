import cloneDeep from 'lodash.clonedeep';

/**
 * Dataset ready to use various strategies for storing the data
 * in a remote storage. Every field backed by this strategy should
 * have a getter and setter defined that interacts with the
 * remote storage. The dataset strategy may be in the following states:
 *
 * - fresh - Purely in-memory created object with no data
 * - unsynced - Some data may be set locally, but they were not
 * propagated to the remote storage, and no data was loaded from the
 * remote storage.
 * - deployed - Data has its representation ready on the remote storage
 * and we may call remote getters and setters to interact with the remote storage.
 * - obsolete - Data lost its representation on the remote storage and
 * we should not interact with it anymore.
 *
 * Internally a state is held for each property. If you `get` a property
 * that was not previously accessed, the whole dataset gets synced (this might
 * get more efficient in the future), and you get a current value from
 * the remote storage. If any value was changed locally, it is considered
 * as the current value. Once you are done with data modification, you
 * have to call `updateRemoteData` that propagates the whole dataset to the
 * remote storage. These calls are deduplicated, so if a single call is used
 * to update multiple properties, only once call is done.
 */
class RemotelyBackedDataset {
  /**
   * Generic factory method.
   */
  static createInstance () {
    return new RemotelyBackedDataset();
  }

  constructor () {
    this.__obsoleteFlag = false;
    this.__deployedFlag = false;
    this.__localData = {};
    this.__remoteData = {};
    this.__fieldStates = {};
    this.__fieldKeys = [];
  }

  /**
   * Creates generic getters and setters that proxy `remoteGetter` and
   * `remoteSetter` when necessary.
   *
   * The fields are specified as an `options.fields` property and every key
   * represents a single property. Every property's options can than hold
   * a `remoteGetter` and `remoteSetter` field such as
   *
   * ```
   * {fields: {
   *     dataUri: {
   *       remoteGetter: async (): Promise<?string> => {
   *         return (await this.contract.dataUri().call();
   *       },
   *       // this will usually return a transaction ID
   *       remoteSetter: async (): Promise<string> => {
   *         return this.contract.methods.callHotel(this.address, data).send(txOptions);
   *       }
   * },
   * ```
   *
   * All passed fields are set as unsynced which means that
   * after the first `get` on any of those, the whole dataset will
   * be synced from the remote storage (if the dataset is marked as deployed).
   *
   * @param  {Object} options `{fields: {[field]: fieldOptions}}`
   * @param  {Object} bindTo  Object to which the properties will be bound.
   * Typically the initiator of this operation.
   */
  bindProperties (options, bindTo) {
    this.__options = options;
    this.__fieldKeys = Object.keys(options.fields);

    for (let i = 0; i < this.__fieldKeys.length; i++) {
      let fieldName = this.__fieldKeys[i];
      this.__fieldStates[fieldName] = 'unsynced';
      Object.defineProperty(bindTo, fieldName, {
        configurable: false,
        enumerable: true,
        get: async () => {
          return this._genericGetter(fieldName);
        },
        set: (newValue) => {
          this._genericSetter(fieldName, newValue);
        },
      });
    }
  }

  /**
   * Is dataset marked as obsolete?
   * @return {Boolean}
   */
  isObsolete () {
    return this.__obsoleteFlag;
  }

  /**
   * Marks dataset as obsolete. Typically called after the remote storage
   * is destroyed or made inaccessible. This is not propagated anywhere
   * but merely serves as a flag to prevent further interaction with this object.
   */
  markObsolete () {
    this.__obsoleteFlag = true;
  }

  /**
   * Is dataset deployed to the remote storage?
   * @return {Boolean}
   */
  isDeployed () {
    return this.__deployedFlag;
  }

  /**
   * Marks dataset as deployed. Typically called when the remote
   * storage is set up, created or connected to.
   */
  markDeployed () {
    this.__deployedFlag = true;
  }

  /**
   * Tries to get a value. If the property was not synced before,
   * it will sync the whole dataset from a remote storage. If a property
   * was modified locally before, the modified value will be returned.
   *
   * @param  {string} property
   * @throws {Error} When dataset is marked as obsolete
   * @return {any} property's current value
   */
  async _genericGetter (property) {
    if (this.isObsolete()) {
      throw new Error('This object was destroyed in a remote storage!');
    }
    // This is a totally new instance
    // TODO maybe don't init all at once, it might be expensive
    if (this.isDeployed() && this.__fieldStates[property] === 'unsynced') {
      await this.__syncRemoteData();
    }

    return this.__localData[property];
  }

  /**
   * Sets a new value locally and marks the property as dirty. Thath
   * means that even after syncing data from remote storage, the object will still
   * serve the locally modified value.
   *
   * @param  {string} property
   * @param  {any} newValue
   */
  _genericSetter (property, newValue) {
    if (this.isObsolete()) {
      throw new Error('This object was destroyed in a remote storage!');
    }
    // Write local value every time, even when we have nothing to compare it to
    if (this.__localData[property] !== newValue || this.__fieldStates[property] === 'unsynced') {
      this.__localData[property] = newValue;
      this.__fieldStates[property] = 'dirty';
    }
  }

  async __fetchRemoteData () {
    if (!this.isDeployed()) {
      throw new Error('Cannot fetch undeployed object');
    }
    const remoteGetters = [];
    for (let i = 0; i < this.__fieldKeys.length; i++) {
      const remoteGetter = this.__options.fields[this.__fieldKeys[i]].remoteGetter;
      if (remoteGetter && this.__fieldStates[this.__fieldKeys[i]] === 'unsynced') {
        remoteGetters.push({
          field: this.__fieldKeys[i],
          fn: remoteGetter(),
        });
      }
    }
    const remoteGetterFields = remoteGetters.map((x) => x.field);
    const remoteGetterFns = remoteGetters.map((x) => x.fn);
    if (remoteGetterFields.length) {
      const attributes = await (Promise.all(remoteGetterFns));
      for (let i = 0; i < remoteGetterFields.length; i++) {
        this.__remoteData[remoteGetterFields[i]] = attributes[i];
      }
    }
    return this.__remoteData;
  }

  async __syncRemoteData () {
    try {
      await this.__fetchRemoteData();
      // Copy over data from remoteData to local data
      for (let i = 0; i < this.__fieldKeys.length; i++) {
        // Do not update user-modified fields
        // TODO deal with 3rd party data modificiation on a remote storage
        if (this.__remoteData[this.__fieldKeys[i]] !== this.__localData[this.__fieldKeys[i]] && this.__fieldStates[this.__fieldKeys[i]] !== 'dirty') {
          this.__localData[this.__fieldKeys[i]] = this.__remoteData[this.__fieldKeys[i]];
          this.__fieldStates[this.__fieldKeys[i]] = 'synced';
        }
      }
    } catch (err) {
      throw new Error('Cannot sync remote data: ' + err.message);
    }
  }

  // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
  __hashCode (text) {
    var hash = 0, i, chr;
    for (i = 0; i < text.length; i++) {
      chr = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Calls all remoteSetters if relevant data was changed.
   * Calls are deduplicated, so if the same method would be used
   * to update multiple fields, it is called only once.
   *
   * @param {WalletInterface} wallet that signs the transaction
   * @param  {Object} transactionOptions passed to every remoteSetter, typically something like `{from: address, to: address}`
   * @return {Array<any>} Results of remoteSetters, it would typically contain transaction IDs
   */
  async updateRemoteData (wallet, transactionOptions) {
    await this.__syncRemoteData();
    const remoteSetters = [];
    const remoteSettersHashCodes = {};
    for (let i = 0; i < this.__fieldKeys.length; i++) {
      const remoteSetter = this.__options.fields[this.__fieldKeys[i]].remoteSetter;
      if (remoteSetter && this.__fieldStates[this.__fieldKeys[i]] === 'dirty') {
        // deduplicate equal calls
        let setterHashCode = this.__hashCode(remoteSetter.toString());
        if (!remoteSettersHashCodes[setterHashCode]) {
          remoteSettersHashCodes[setterHashCode] = true;
          remoteSetters.push(remoteSetter(wallet, cloneDeep(transactionOptions)).then((result) => {
            this.__fieldStates[this.__fieldKeys[i]] = 'synced';
            return result;
          }));
        }
      }
    }
    return Promise.all(remoteSetters);
  }
}

export default RemotelyBackedDataset;
