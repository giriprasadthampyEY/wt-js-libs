// @flow
import type { OffChainDataAdapterInterface } from './interfaces';
import OffChainDataClient from './off-chain-data-client';

/**
 * Definition of a data field that is stored off-chain.
 * This may be recursive.
 */
type FieldDefType = {
  name: string,
  isStoragePointer?: boolean,
  fields?: Array<FieldDefType | string>
};

/**
 * `StoragePointer` serves as a representation of an
 * off-chain document holding JSON data. This generic class
 * does not enforce any protocol/schema and contains
 * infrastructure code that helps to set up field definition
 * and getters for every data field. It does not provide any
 * means of writing data, its sole purpose is for reading.
 *
 * It is possible to use this recursively, so you can define
 * a field as another storage pointer. The configuration is
 * declarative and may look like this:
 *
 * ```
 * const pointer = StoragePointer.createInstance('some://url', ['name', 'description']);
 * pointer.ref; // contains 'some://url',
 * await pointer.contents.name;
 * await pointer.contents.description;
 * ```
 *
 * Or in recursive cases:
 *
 * ```
 * const pointer = StoragePointer.createInstance('some://url', [
 *   {
 *     name: 'description',
 *     isStoragePointer: true,
 *     fields: ['name', 'description', 'location'],
 *   },
 *   'signature'
 * ]);
 * pointer.ref; // contains  'some://url'
 * await pointer.contents.signature;
 * const descPointer = await pointer.contents.description;
 * descPointer.ref; // contains whatever is written in a description property in a document located on 'some://url'
 * await descPointer.contents.name;
 * ```
 *
 * Only a top-level properties have to be defined beforehand, so the `signature`
 * field above may contain a complex JSON object.
 */
class StoragePointer {
  ref: string;
  contents: Object;
  __storagePointers: {[string]: StoragePointer};
  __downloaded: boolean;
  __data: ?{[string]: Object};
  __fields: Array<FieldDefType>;
  __adapter: OffChainDataAdapterInterface;
  __downloading: ?Promise<void>;

  /**
   * Returns a new instance of StoragePointer.
   *
   * Normalizes the `fields` format before creating the actual
   * instance
   *
   * @param {string} uri where to look for data document. It has to include schema, i. e. `https://example.com/data`
   * @param {Array<FieldDefType | string>} fields list of top-level fields in the referred document
   * @throw {Error} if uri is not defined
   */
  static createInstance (uri: ?string, fields: ?Array<FieldDefType | string>): StoragePointer {
    if (!uri) {
      throw new Error('Cannot instantiate StoragePointer without uri');
    }
    fields = fields || [];
    const normalizedFieldDef = [];
    // TODO deal with field name uniqueness
    for (let fieldDef of fields) {
      if (typeof fieldDef === 'string') {
        normalizedFieldDef.push({
          name: fieldDef,
        });
      } else {
        normalizedFieldDef.push(fieldDef);
      }
    }
    return new StoragePointer(uri, normalizedFieldDef);
  }

  /**
   * Detects schema from the uri, based on that instantiates an appropriate
   * `OffChainDataAdapterInterface` implementation and sets up all data
   * getters.
   *
   * @param  {string} uri where to look for the data
   * @param  {Array<FieldDefType>} fields definition from which are generated getters
   */
  constructor (uri: string, fields: Array<FieldDefType>) {
    this.ref = uri;
    this.contents = {};
    this.__storagePointers = {};
    this.__downloaded = false;
    this.__data = null;
    this.__fields = fields;

    for (let i = 0; i < this.__fields.length; i++) {
      let fieldDef = this.__fields[i];
      Object.defineProperty(this.contents, fieldDef.name, {
        configurable: false,
        enumerable: true,
        get: async () => {
          return this._genericGetter(fieldDef.name);
        },
      });
    }
  }

  /**
   * Reset the storage pointer, thus forcing it to lazily
   * download the data again.
   *
   * Usable when the the off-chain data might have changed since
   * the last query and the most recent version of it is needed.
   */
  async reset (): Promise<void> {
    // If the download is still in progress, wait for it to
    // finish to reduce race condition possibilities.
    await (this.__downloading || Promise.resolve());
    // Force repeated download upon the next contents access.
    delete this.__downloading;
    this.__downloaded = false;
  }

  /**
   * Lazy data getter. The contents file gets downloaded only
   * once any data field is accessed for the first time. Also
   * the recursive `StoragePointer`s are created here only
   * after the contents of the data is known, because we need
   * to know the uri to be able to instantiate the appropariate
   * `StoragePointer`.
   *
   * This behaviour might change in a way that we are able to
   * swap the StoragePointer implementation during runtime.
   */
  async _genericGetter (field: string): StoragePointer | Object {
    if (!this.__downloaded) {
      await this._downloadFromStorage();
    }
    if (this.__storagePointers[field]) {
      return this.__storagePointers[field];
    }
    return this.__data && this.__data[field];
  }

  /**
   * Detects schema from an uri, i. e.
   * from `json://some-data`, detects `json`.
   */
  _detectSchema (uri: string): ?string {
    const matchResult = uri.match(/([a-z-]+):\/\//i);
    return matchResult ? matchResult[1] : null;
  }

  /**
   * Returns appropriate implementation of `OffChainDataAdapterInterface`
   * based on schema. Uses `OffChainDataClient.getAdapter` factory method.
   */
  async _getOffChainDataClient (): Promise<OffChainDataAdapterInterface> {
    if (!this.__adapter) {
      this.__adapter = await OffChainDataClient.getAdapter(this._detectSchema(this.ref));
    }
    return this.__adapter;
  }

  /**
   * Sets the internal properties (__data, __storagePointers)
   * based on the data retrieved from the storage.
   */
  _initFromStorage (data: Object) {
    this.__data = data;
    this.__storagePointers = {};
    for (let i = 0; i < this.__fields.length; i++) {
      const fieldDef = this.__fields[i];
      if (fieldDef.isStoragePointer) {
        if (!this.__data[fieldDef.name] || typeof this.__data[fieldDef.name] !== 'string') {
          const value = this.__data[fieldDef.name] ? (this.__data[fieldDef.name]).toString() : 'undefined';
          throw new Error(`Cannot access ${fieldDef.name} under value ${value} which does not appear to be a valid reference.`);
        }
        this.__storagePointers[fieldDef.name] = StoragePointer.createInstance(this.__data[fieldDef.name], fieldDef.fields || []);
      }
    }
  }

  /**
   * Gets the data document via `OffChainDataAdapterInterface`
   * and uses it to initialize the internal state.
   */
  async _downloadFromStorage (): Promise<void> {
    if (!this.__downloading) {
      this.__downloading = (async () => {
        const adapter = await this._getOffChainDataClient();
        const data = (await adapter.download(this.ref)) || {};
        this._initFromStorage(data);
        this.__downloaded = true;
      })();
    }
    return this.__downloading;
  }

  /**
   * Recursively transforms the off chain stored document to a sync plain
   * javascript object. By default, traverses the whole document tree.
   *
   * You can limit which branches will get downloaded by providing a `resolvedFields`
   * argument which acccepts a list of paths in dot notation (`father.son.child`).
   * Every child will then get resolved recursively.
   *
   * If you don't want some paths to get downloaded, just provide at least one sibling
   * field on that level which is not a `StoragePointer`.
   *
   * Data always gets downloaded if this method is called.
   *
   * The resulting structure mimicks the original `StoragePointer` data structure:
   *
   * ```
   * {
   *   'ref': 'schema://url',
   *   'contents': {
   *     'field': 'value',
   *     'storagePointer': {
   *       'ref': 'schema://originalUri',
   *       'contents': {
   *          'field': 'value'
   *       }
   *     },
   *     'unresolvedStoragePointer': 'schema://unresolved-url'
   *   }
   * }
   * ```
   *
   *  @param {resolvedFields} list of fields that limit the resulting dataset in dot notation (`father.child.son`)
   */
  async toPlainObject (resolvedFields: ?Array<string>): Promise<{ref: string, contents: Object}> {
    // Download data
    await this._downloadFromStorage();
    let result = {};
    let currentFieldDef = {};
    // Prepare subtrees that will possibly be resolved later by splitting the dot notation.
    if (resolvedFields) {
      for (let field of resolvedFields) {
        let currentLevelName, remainingPath;
        if (field.indexOf('.') === -1) {
          currentLevelName = field;
        } else {
          currentLevelName = field.substring(0, field.indexOf('.'));
          remainingPath = field.substring(field.indexOf('.') + 1);
        }
        if (remainingPath) {
          if (!currentFieldDef[currentLevelName]) {
            currentFieldDef[currentLevelName] = [];
          }
          currentFieldDef[currentLevelName].push(remainingPath);
        } else {
          currentFieldDef[currentLevelName] = undefined;
        }
      }
    }

    // Put everything together
    for (let field of this.__fields) {
      if (this.__storagePointers[field.name]) {
        // Storage pointer that the user wants to get resolved - call again for a subtree
        // OR resolve the whole subrtree if no special field is requested
        if (!resolvedFields || currentFieldDef.hasOwnProperty(field.name)) {
          result[field.name] = await (await this.contents[field.name]).toPlainObject(currentFieldDef[field.name]);
        } else { // Unresolved storage pointer, return a URI
          result[field.name] = this.__storagePointers[field.name].ref;
        }
      } else {
        result[field.name] = await this.contents[field.name];
      }
    }
    return {
      ref: this.ref,
      contents: result,
    };
  }
}

export default StoragePointer;
