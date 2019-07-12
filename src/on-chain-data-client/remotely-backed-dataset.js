import cloneDeep from 'lodash.clonedeep';

import { RemoteDataAccessError, RemoteDataReadError } from './errors';

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
export class RemotelyBackedDataset {
  /**
   * Generic factory method.
   */
  static createInstance () {
    return new RemotelyBackedDataset();
  }

  constructor () {
    this._obsoleteFlag = false;
    this._deployedFlag = false;
    this._localData = {};
    this._remoteData = {};
    this._fieldStates = {};
    this._fieldKeys = [];
    this._syncing = null;
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
   *     orgJsonUri: {
   *       remoteGetter: async (): Promise<?string> => {
   *         return (await this.contract.orgJsonUri().call();
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
    this._options = options;
    this._fieldKeys = Object.keys(options.fields);

    for (let i = 0; i < this._fieldKeys.length; i++) {
      const fieldName = this._fieldKeys[i];
      this._fieldStates[fieldName] = 'unsynced';
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
    return this._obsoleteFlag;
  }

  /**
   * Marks dataset as obsolete. Typically called after the remote storage
   * is destroyed or made inaccessible. This is not propagated anywhere
   * but merely serves as a flag to prevent further interaction with this object.
   */
  markObsolete () {
    this._obsoleteFlag = true;
  }

  /**
   * Is dataset deployed to the remote storage?
   * @return {Boolean}
   */
  isDeployed () {
    return this._deployedFlag;
  }

  /**
   * Marks dataset as deployed. Typically called when the remote
   * storage is set up, created or connected to.
   */
  markDeployed () {
    this._deployedFlag = true;
  }

  /**
   * Tries to get a value. If the property was not synced before,
   * it will sync the whole dataset from a remote storage. If a property
   * was modified locally before, the modified value will be returned.
   *
   * @param  {string} property
   * @throws {RemoteDataAccessError} When dataset is marked as obsolete
   * @return {any} property's current value
   */
  async _genericGetter (property) {
    if (this.isObsolete()) {
      throw new RemoteDataAccessError('This object was destroyed in a remote storage!');
    }
    // This is a totally new instance
    // TODO maybe don't init all at once, it might be expensive
    if (this.isDeployed() && this._fieldStates[property] === 'unsynced') {
      return this._syncRemoteData().then(() => {
        return this._localData[property];
      });
    }

    return this._localData[property];
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
      throw new RemoteDataAccessError('This object was destroyed in a remote storage!');
    }
    // Write local value every time, even when we have nothing to compare it to
    if (this._localData[property] !== newValue || this._fieldStates[property] === 'unsynced') {
      this._localData[property] = newValue;
      this._fieldStates[property] = 'dirty';
    }
  }

  async _fetchRemoteData () {
    if (!this.isDeployed()) {
      throw new RemoteDataAccessError('Cannot fetch undeployed object');
    }
    const remoteGetters = [];
    for (let i = 0; i < this._fieldKeys.length; i++) {
      const remoteGetter = this._options.fields[this._fieldKeys[i]].remoteGetter;
      if (remoteGetter && this._fieldStates[this._fieldKeys[i]] === 'unsynced') {
        remoteGetters.push({
          field: this._fieldKeys[i],
          fn: remoteGetter(),
        });
      }
    }
    const remoteGetterFields = remoteGetters.map((x) => x.field);
    const remoteGetterFns = remoteGetters.map((x) => x.fn);
    if (remoteGetterFields.length) {
      const attributes = await (Promise.all(remoteGetterFns));
      for (let i = 0; i < remoteGetterFields.length; i++) {
        this._remoteData[remoteGetterFields[i]] = attributes[i];
      }
    }
    return this._remoteData;
  }

  async _syncRemoteData () {
    if (!this._syncing) {
      this._syncing = (async () => {
        try {
          await this._fetchRemoteData();
          // Copy over data from remoteData to local data
          for (let i = 0; i < this._fieldKeys.length; i++) {
            // Do not update user-modified fields
            // TODO deal with 3rd party data modificiation on a remote storage
            if (this._remoteData[this._fieldKeys[i]] !== this._localData[this._fieldKeys[i]] && this._fieldStates[this._fieldKeys[i]] !== 'dirty') {
              this._localData[this._fieldKeys[i]] = this._remoteData[this._fieldKeys[i]];
              this._fieldStates[this._fieldKeys[i]] = 'synced';
            }
          }
        } catch (err) {
          throw new RemoteDataReadError('Cannot sync remote data: ' + err.message);
        }
      })();
    }
    return this._syncing;
  }

  // https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript-jquery
  _hashCode (text) {
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
   * @param  {Object} transactionOptions passed to every remoteSetter, typically something like `{from: address, to: address}`
   * @return {Array<any>} Results of remoteSetters, it would typically contain transaction metadata. In any case, an eventCallbacks
   * object is appended to every result and onReceipt callback is added to ensure that data fields would eventually be properly marked as 'synced'.
   */
  async updateRemoteData (transactionOptions) {
    await this._syncRemoteData();
    const remoteSetters = [];
    const remoteSettersHashCodes = {};
    for (let i = 0; i < this._fieldKeys.length; i++) {
      const remoteSetter = this._options.fields[this._fieldKeys[i]].remoteSetter;
      if (remoteSetter && this._fieldStates[this._fieldKeys[i]] === 'dirty') {
        // deduplicate equal calls
        const setterHashCode = this._hashCode(remoteSetter.toString());
        if (!remoteSettersHashCodes[setterHashCode]) {
          remoteSettersHashCodes[setterHashCode] = true;
          remoteSetters.push(remoteSetter(cloneDeep(transactionOptions)).then((result) => {
            result.eventCallbacks = result.eventCallbacks || {};
            const originalOnRcptCallback = result.eventCallbacks.onReceipt;
            const onRcptCallback = (receipt) => {
              this._fieldStates[this._fieldKeys[i]] = 'synced';
              if (originalOnRcptCallback) {
                return originalOnRcptCallback(receipt);
              }
            };
            result.eventCallbacks.onReceipt = onRcptCallback;
            return result;
          }));
        }
      }
    }
    return Promise.all(remoteSetters);
  }
}

export default RemotelyBackedDataset;
