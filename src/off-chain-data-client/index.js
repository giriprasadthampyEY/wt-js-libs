import {
  OffChainDataConfigurationError,
  OffChainDataRuntimeError,
} from './errors';

/**
 * OffChainDataClient is a static factory class that is responsible
 * for creating proper instances of OffChainDataAdapterInterface.
 * It is configured during the library initialization.
 *
 * Please bear in mind, that once the adapters are configured, the
 * configuration is shared during the whole runtime.
 */
export class OffChainDataClient {

  /**
   * Initializes the map of OffChainDataAdapters.
   *
   * @param  {OffChainDataClientOptionsType}
   * @throws {OffChainDataConfigurationError} when there are multiple adapters with the same name
   */
  static setup (options) {
    OffChainDataClient.adapters = {};
    OffChainDataClient.options = options || {};
    // Convert all adapter keys (i.e. URL schemes) to lowercase.
    for (let key of Object.keys(OffChainDataClient.options.adapters || {})) {
      let normalizedKey = key.toLowerCase();
      if (OffChainDataClient.adapters[normalizedKey]) {
        throw new OffChainDataConfigurationError(`Adapter declared twice: ${normalizedKey}`);
      }
      OffChainDataClient.adapters[normalizedKey] = OffChainDataClient.options.adapters[key];
    }
  }

  /**
   * Drops all pre-configured OffChainDataAdapters. Useful for testing.
   */
  static _reset () {
    OffChainDataClient.options = {};
    OffChainDataClient.adapters = {};
  }

  /**
   * Returns a fresh instance of an appropriate OffChainDataAdapter by
   * calling the `create` function from the adapter's configuration.
   *
   * @throws {OffChainDataRuntimeError} when schema is not defined or adapter for this schema does not exist
   */
  static getAdapter (schema) {
    schema = schema && schema.toLowerCase();
    if (!schema || !OffChainDataClient.adapters[schema]) {
      throw new OffChainDataRuntimeError(`Unsupported data storage type: ${schema || 'null'}`);
    }
    const adapter = OffChainDataClient.adapters[schema];
    return adapter.create(adapter.options);
  }
}

export default OffChainDataClient;
