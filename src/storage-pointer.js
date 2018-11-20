// @flow
import type { OffChainDataAdapterInterface } from './interfaces';
import OffChainDataClient from './off-chain-data-client';

import { StoragePointerError } from './errors';

/**
 * Definition of a data field that is stored off-chain.
 * This may be recursive.
 */
type ChildType = {
  required?: boolean,
  // If `nested` is true, we assume the child is actually an object whose keys are field names and values are uris.
  nested?: boolean,
  children?: ChildrenType
};

type ChildrenType = {[string]: ChildType};

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
 * const pointer = StoragePointer.createInstance('some://url');
 * pointer.ref; // contains 'some://url',
 * contents = await pointer.contents;
 * contents.name;
 * contents.description;
 * // etc.
 * ```
 *
 * Or in recursive cases:
 *
 * ```
 * const pointer = StoragePointer.createInstance('some://url', {
 *   description: {
 *     required: false,
 *   },
 * });
 * pointer.ref; // contains  'some://url'
 * contents = await pointer.contents;
 * contents.signature;
 * const descPointer = contents.description;
 * descPointer.ref; // contains whatever is written in a description property in a document located on 'some://url'
 * descContents = await descPointer.contents;
 * ```
 * so if you mark a storage pointer as not required, the library will not crash if the field
 * is missing or nulled.
 *
 * Only subordinate storage pointers (`children`) have to be defined beforehand, so the `signature`
 * field above may contain a complex JSON object.
 */
class StoragePointer {
  ref: string;
  contents: Promise<Object>;
  _downloaded: boolean;
  _data: {[string]: Object};
  _children: ?ChildrenType;
  _adapter: OffChainDataAdapterInterface;
  _downloading: ?Promise<void>;

  /**
   * Returns a new instance of StoragePointer.
   *
   * Normalizes the `fields` format before creating the actual
   * instance
   *
   * @param {string} uri where to look for data document. It has to include schema, i. e. `https://example.com/data`
   * @param {ChildrenType} children subordinate storage pointers
   * @throw {StoragePointerError} if uri is not defined
   */
  static createInstance (uri: ?string, children: ?ChildrenType): StoragePointer {
    if (!uri) {
      throw new StoragePointerError('Cannot instantiate StoragePointer without uri');
    }
    const uniqueFields = {};
    children = children || {};
    
    for (let fieldName in children) {
      if (uniqueFields[fieldName.toLowerCase()]) {
        throw new StoragePointerError('Cannot create instance: Conflict in field names.');
      }
      if (children[fieldName].required === undefined) {
        children[fieldName].required = true;
      }
      uniqueFields[fieldName.toLowerCase()] = 1;
    }
    return new StoragePointer(uri, children);
  }

  /**
   * Detects schema from the uri, based on that instantiates an appropriate
   * `OffChainDataAdapterInterface` implementation and sets up all data
   * getters.
   *
   * @param {string} uri where to look for the data
   * @param {ChildrenType} children subordinate storage pointers
   */
  constructor (uri: string, children: ChildrenType) {
    this.ref = uri;
    this._downloaded = false;
    this._data = {};
    this._children = children || [];
  }

  get contents (): {[string]: Object} {
    return (async () => {
      if (!this._downloaded) {
        await this._downloadFromStorage();
      }
      return this._data;
    })();
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
    await (this._downloading || Promise.resolve());
    // Force repeated download upon the next contents access.
    delete this._downloading;
    this._downloaded = false;
  }

  /**
   * Detects schema from an uri, i. e.
   * from `schema://some-data`, detects `schema`.
   */
  _detectSchema (uri: string): ?string {
    const matchResult = uri.match(/([a-zA-Z-]+):\/\//i);
    return matchResult ? matchResult[1] : null;
  }

  /**
   * Returns appropriate implementation of `OffChainDataAdapterInterface`
   * based on schema. Uses `OffChainDataClient.getAdapter` factory method.
   */
  _getOffChainDataClient (): OffChainDataAdapterInterface {
    if (!this._adapter) {
      this._adapter = OffChainDataClient.getAdapter(this._detectSchema(this.ref));
    }
    return this._adapter;
  }

  /**
   * Sets the internal _data property based on the data retrieved from
   * the storage.
   */
  _initFromStorage (data: Object) {
    this._data = Object.assign({}, data); // Copy top-level data to avoid issues with mutability.
    for (let fieldName in this._children) {
      const fieldData = this._data[fieldName],
        fieldDef = this._children[fieldName],
        expectedType = fieldDef.nested ? 'object' : 'string';
      if (fieldDef.required && !fieldData) {
        throw new StoragePointerError(`Cannot access field '${fieldName}' which is required.`);
      }
      if (!fieldData) {
        continue;
      }
      if (typeof fieldData !== expectedType) { // eslint-disable-line valid-typeof
        const value = fieldData ? fieldData.toString() : 'undefined';
        throw new StoragePointerError(`Cannot access field '${fieldName}' on '${value}' which does not appear to be of type ${expectedType}.`);
      }
      if (fieldDef.nested) {
        const pointers = {};
        for (let key of Object.keys(fieldData)) {
          if (typeof fieldData[key] !== 'string') {
            throw new StoragePointerError(`Cannot access field '${fieldName}.${key}' which does not appear to be of type string.`);
          }
          pointers[key] = StoragePointer.createInstance(fieldData[key], fieldDef.children || {});
        }
        this._data[fieldName] = pointers;
      } else {
        this._data[fieldName] = StoragePointer.createInstance(fieldData, fieldDef.children || {});
      }
    }
  }

  /**
   * Gets the data document via `OffChainDataAdapterInterface`
   * and uses it to initialize the internal state.
   */
  async _downloadFromStorage (): Promise<void> {
    if (!this._downloading) {
      this._downloading = (async () => {
        const adapter = this._getOffChainDataClient();
        try {
          const data = (await adapter.download(this.ref)) || {};
          this._initFromStorage(data);
          this._downloaded = true;
        } catch (err) {
          if (err instanceof StoragePointerError) {
            throw err;
          }
          throw new StoragePointerError('Cannot download data: ' + err.message, err);
        }
      })();
    }
    return this._downloading;
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
   * field on that level which is not a `StoragePointer`. An empty list means no fields
   * will be resolved.
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
   *  @param {resolvedFields} list of fields that limit the resulting dataset in dot notation (`father.child.son`).
   *  If an empty array is provided, no resolving is done. If the argument is missing, all fields are resolved.
   *
   * @throws {StoragePointerError} when an adapter encounters an error while accessing the data
   */
  async toPlainObject (resolvedFields: ?Array<string>): Promise<{ref: string, contents: Object}> {
    // Download data
    await this._downloadFromStorage();
    let result = {};
    // Prepare subtrees that will possibly be resolved later by splitting the dot notation.
    let currentFieldDef = {};
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
    let contents = await this.contents;
    for (let fieldName in this._data) {
      if (!this._children || !this._children[fieldName]) {
        // Do not fabricate undefined fields if they are actually missing in the source data
        if (this._data && this._data.hasOwnProperty(fieldName)) {
          result[fieldName] = contents[fieldName];
        }
        continue;
      }

      // Check if the user wants to resolve the child StoragePointer;
      const resolve = !resolvedFields || currentFieldDef.hasOwnProperty(fieldName),
        nested = this._children && this._children[fieldName].nested;

      if (nested) {
        result[fieldName] = {};
        for (let key of Object.keys(contents[fieldName])) {
          if (resolve) {
            result[fieldName][key] = await contents[fieldName][key].toPlainObject(currentFieldDef[fieldName]);
          } else {
            result[fieldName][key] = contents[fieldName][key].ref;
          }
        }
      } else {
        if (resolve) {
          result[fieldName] = await contents[fieldName].toPlainObject(currentFieldDef[fieldName]);
        } else {
          result[fieldName] = this._data[fieldName].ref;
        }
      }
    }
    return {
      ref: this.ref,
      contents: result,
    };
  }
}

export default StoragePointer;
