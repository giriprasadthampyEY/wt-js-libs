// @flow
import cloneDeep from 'lodash.clonedeep';
import type { OffChainDataAdapterInterface } from './interfaces/base-interfaces';
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

/**
 * Structure definition of `ChildType`.
 */
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
 * descContents = await descPointer.contents; // data from descPointer.ref
 * ```
 * so if you mark a storage pointer as not required, the library will not crash if the field
 * is missing or nulled.
 *
 * Only subordinate storage pointers (`children`) have to be defined beforehand, so the `signature`
 * field above may contain a complex JSON object.
 *
 * Recursion is supported, if described in `children` definition.
 * See [test](https://github.com/windingtree/wt-js-libs/blob/8fdfe3aed7248fd327b60f1a56f0d3a3b1d3e93b/test/wt-libs/storage-pointer.spec.js#L448) for a working example.
 * ```
 * const innerUri = InMemoryAdapter.storageInstance.create({
 *   data: 'wt',
 * });
 * const outerUri = InMemoryAdapter.storageInstance.create({
 *   detail: `in-memory://${innerUri}`,
 *   bar: 'foo',
 * });
 * const pointer = StoragePointer.createInstance(`in-memory://${outerUri}`, {
 *   detail: {
 *     children: {},
 *   },
 * });
 * pointer.ref; // contains outerUri
 * let contents = await pointer.contents;
 * contents.bar; // contains 'foo'
 * contents.detail.ref; // contains innerUri
 * (await contents.detail.contents).data; // contains 'wt'. See `toPlainObject` if you want to avoid multiple `await` clauses.
 * ```
 *
 * StoragePointers in arrays are also supported, see [an example](https://github.com/windingtree/wt-js-libs/blob/8fdfe3aed7248fd327b60f1a56f0d3a3b1d3e93b/test/wt-libs/storage-pointer.spec.js#L427).
 * Note that arrays are not supported for `nested` children types.
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
  async reset () {
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
    this._data = cloneDeep(data); // Copy data to avoid issues with mutability.
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
      if (!Array.isArray(fieldData) && typeof fieldData !== expectedType) { // eslint-disable-line valid-typeof
        const value = fieldData ? fieldData.toString() : 'undefined';
        throw new StoragePointerError(`Cannot access field '${fieldName}' on '${value}' which does not appear to be of type ${expectedType} but ${typeof fieldData}.`);
      }
      if (fieldDef.nested) {
        if (Array.isArray(fieldData)) {
          throw new StoragePointerError(`Cannot access field '${fieldName}'. Nested pointer cannot be an Array.`);
        } else {
          const pointers = {};
          for (let key of Object.keys(fieldData)) {
            if (typeof fieldData[key] !== 'string') {
              throw new StoragePointerError(`Cannot access field '${fieldName}.${key}' which does not appear to be of type string.`);
            }
            pointers[key] = StoragePointer.createInstance(fieldData[key], fieldDef.children || {});
          }
          this._data[fieldName] = pointers;
        }
      } else {
        if (Array.isArray(fieldData)) {
          this._data[fieldName] = [];
          for (let i = 0; i < fieldData.length; i++) {
            this._data[fieldName].push(fieldData[i]);
            for (let refName in fieldDef.children) {
              if (!fieldData[i][refName].ref || !fieldData[i][refName].contents) {
                this._data[fieldName][i][refName] = StoragePointer.createInstance(fieldData[i][refName], fieldDef.children[refName].children);
              }
            }
          }
        } else {
          this._data[fieldName] = StoragePointer.createInstance(fieldData, fieldDef.children || {});
        }
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
   *     'storagePointers': [ // pointers in arrays are resolved as well
   *       {
   *         'ref': 'schema://originalUri1',
   *         'contents': {
   *            'field': 'value1'
   *         }
   *       },{
   *         'ref': 'schema://originalUri2',
   *         'contents': {
   *            'field': 'value2'
   *         }
   *       }
   *     ],
   *     'unresolvedStoragePointer': 'schema://unresolved-url'
   *   }
   * }
   * ```
   *
   * @param {Array<string>} resolvedFields List of fields that limit the resulting dataset in dot notation (`father.child.son`).
   *  If an empty array is provided, no resolving is done. If the argument is missing, all fields are resolved.
   *  You don't need to specify path to a field in any special way when it is in an array (e.g. storagePointers.0.field or similar).
   *  Array items are resolved as if they're on the array level (i.e. storagePointers.field).
   * @param {integer} depth Number of levels to resolve in case no `resolvedFields` are specified on a level anymore.
   *  Note that calling `toPlainObject` with specified fields may lead to fields being not specified in recursive calls
   *  (e.g. when calling `toPlainObject(['a.b'])` all fields in data.a.b will be resolved - unless limited by depth).
   * @throws {StoragePointerError} when an adapter encounters an error while accessing the data
   */
  async toPlainObject (resolvedFields: ?Array<string>, depth?: number = 9999): Promise<{ref: string, contents: Object}> {
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
    if (Array.isArray(contents)) {
      result = contents;
    } else {
      for (let fieldName in this._data) {
        if (!this._children || !this._children[fieldName]) {
          // Do not fabricate undefined fields if they are actually missing in the source data
          if (this._data && this._data.hasOwnProperty(fieldName)) {
            result[fieldName] = contents[fieldName];
          }
          continue;
        }

        // Check if the user wants to resolve the child StoragePointer;
        const resolve = (!resolvedFields && depth > 0) || currentFieldDef.hasOwnProperty(fieldName),
          nested = this._children && this._children[fieldName].nested;

        if (nested) {
          result[fieldName] = {};
          for (let key of Object.keys(contents[fieldName])) {
            if (resolve && depth > 1) {
              result[fieldName][key] = await contents[fieldName][key].toPlainObject(currentFieldDef[fieldName], depth - 2);
            } else {
              result[fieldName][key] = contents[fieldName][key].ref;
            }
          }
        } else {
          if (resolve) {
            if (Array.isArray(contents[fieldName])) {
              result[fieldName] = [];
              for (let i = 0; i < contents[fieldName].length; i++) {
                result[fieldName].push(contents[fieldName][i]);
                for (let key of Object.keys(contents[fieldName][i])) {
                  if (contents[fieldName][i][key].toPlainObject && depth > 1) {
                    result[fieldName][i][key] = await contents[fieldName][i][key].toPlainObject(currentFieldDef[fieldName], depth - 2);
                  }
                }
              }
            } else {
              result[fieldName] = await contents[fieldName].toPlainObject(currentFieldDef[fieldName], depth - 1);
            }
          } else {
            result[fieldName] = this._data[fieldName].ref;
          }
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
