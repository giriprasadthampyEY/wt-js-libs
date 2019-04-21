// @flow
import type { OffChainDataAdapterInterface } from '../interfaces/base-interfaces';

import {
  OffChainDataConfigurationError,
  OffChainDataRuntimeError,
} from './errors';

/**
 * OffChainDataClientOptionsType
 */
export type OffChainDataClientOptionsType = {
  adapters: {[schema: string]: {
    options: Object,
    create: (options: Object) => OffChainDataAdapterInterface
  }}
};

let offChainDataOptions: OffChainDataClientOptionsType;

/**
 * OffChainDataClient is a static factory class that is responsible
 * for creating proper instances of OffChainDataAdapterInterface.
 * It is configured during the library initialization.
 *
 * Please bear in mind, that once the adapters are configured, the
 * configuration is shared during the whole runtime.
 */
export class OffChainDataClient {
  adapters: Object;

  /**
   * Initializes the map of OffChainDataAdapters.
   *
   * @param  {OffChainDataClientOptionsType}
   * @throws {OffChainDataConfigurationError} when there are multiple adapters with the same name
   */
  static setup (options: OffChainDataClientOptionsType) {
    offChainDataOptions = options || {};
    let adapters = {};
    // Convert all adapter keys (i.e. URL schemes) to lowercase.
    for (let key of Object.keys(offChainDataOptions.adapters || {})) {
      let normalizedKey = key.toLowerCase();
      if (normalizedKey in adapters) {
        throw new OffChainDataConfigurationError(`Adapter declared twice: ${normalizedKey}`);
      }
      adapters[normalizedKey] = offChainDataOptions.adapters[key];
    }
    offChainDataOptions.adapters = adapters;
  }

  /**
   * Drops all pre-configured OffChainDataAdapters. Useful for testing.
   */
  static _reset () {
    offChainDataOptions.adapters = {};
  }

  /**
   * Returns a fresh instance of an appropriate OffChainDataAdapter by
   * calling the `create` function from the adapter's configuration.
   *
   * @throws {OffChainDataRuntimeError} when schema is not defined or adapter for this schema does not exist
   */
  static getAdapter (schema: ?string): OffChainDataAdapterInterface {
    schema = schema && schema.toLowerCase();
    if (!schema || !offChainDataOptions.adapters[schema]) {
      throw new OffChainDataRuntimeError(`Unsupported data storage type: ${schema || 'null'}`);
    }
    const adapter = offChainDataOptions.adapters[schema];
    return adapter.create(adapter.options);
  }
}

export default OffChainDataClient;
