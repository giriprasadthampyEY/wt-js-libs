import Web3Eth from 'web3-eth';
import Web3Utils from 'web3-utils';
import {
  TrustClueConfigurationError,
  TrustClueRuntimeError,
} from './errors';

/**
 * TrustClueClient is a static factory class that is responsible
 * for creating proper instances of `TrustClueInterface`s.
 * It is configured during the library initialization.
 *
 * Please bear in mind, that once the clues are configured, the
 * configuration is shared during the whole runtime.
 */
export class TrustClueClient {
  /**
   * Initializes the map of `TrustClue`s.
   *
   * @param  {TrustClueClientOptionsType}
   * @throws {TrustClueConfigurationError} when there are multiple clues with the same name
   */
  static createInstance (options) {
    options = options || {};
    let clues = {};
    // Convert all trust clue names to lowercase.
    for (let key of Object.keys(options.clues || {})) {
      let normalizedKey = key.toLowerCase();
      if (clues[normalizedKey]) {
        throw new TrustClueConfigurationError(`Clue declared twice: ${normalizedKey}`);
      }
      clues[normalizedKey] = options.clues[key];
    }
    options.clues = clues;
    return new TrustClueClient(options);
  }

  constructor (options) {
    this._clues = {};
    this.options = options || {};
    this.clueNameList = Object.keys(options.clues);
    this.web3Eth = new Web3Eth(options.provider);
  }

  /**
   * Returns a fresh instance of an appropriate TrustClue by
   * calling the `create` function from the clue's configuration.
   *
   * @throws {TrustClueRuntimeError} when name is not defined or a clue with such name does not exist
   */
  async getClue (name) {
    name = name && name.toLowerCase();

    if (this._clues[name]) {
      return this._clues[name];
    }

    if (!name || !this.options.clues[name]) {
      throw new TrustClueRuntimeError(`Unsupported trust clue type: ${name || 'null'}`);
    }

    const clueDeclaration = this.options.clues[name];
    const clueInstance = await clueDeclaration.create(clueDeclaration.options);
    this._clues[name] = clueInstance;
    return this._clues[name];
  }

  /**
   * Returns a list of metadata for all clues.
   */
  async getMetadataForAllClues () {
    const trustClues = [];
    for (let i = 0; i < this.clueNameList.length; i++) {
      const clue = await this.getClue(this.clueNameList[i]);
      trustClues.push(await clue.getMetadata());
    }
    return trustClues;
  }

  /**
   * Walks over all clues and collects their values.
   * @param {string} address Ethereum address for which the values should
   * be collected.
   * @returns A list of objects with either value or error:
   * `{name: clue-name, value: value, error: error message}`
   */
  async getAllValues (address) {
    let promises = [];
    for (let i = 0; i < this.clueNameList.length; i++) {
      const getClueValue = this.getClue(this.clueNameList[i])
        .then((clue) => {
          return clue.getValueFor(address);
        })
        .then((value) => ({
          name: this.clueNameList[i],
          value: value,
        }))
        .catch((e) => ({
          name: this.clueNameList[i],
          error: e.toString(),
        }));
      promises.push(getClueValue);
    }
    return Promise.all(promises);
  }

  /**
   * Walks over all clues and collects their interpreted values.
   * @param {string} address Ethereum address for which the values should
   * be collected.
   * @returns A list of objects with either value or error:
   * `{name: clue-name, value: value, error: error message}`
   */
  async interpretAllValues (address) {
    let promises = [];
    for (let i = 0; i < this.clueNameList.length; i++) {
      const getClueValue = this.getClue(this.clueNameList[i])
        .then((clue) => {
          return clue.interpretValueFor(address);
        })
        .then((value) => ({
          name: this.clueNameList[i],
          value: value,
        }))
        .catch((e) => ({
          name: this.clueNameList[i],
          error: e.toString(),
        }));
      promises.push(getClueValue);
    }
    return Promise.all(promises);
  }

  /**
   * Verifies the signature and actual signer.
   *
   * @param {string} serializedData String data to be signed.
   * @param {string} signature Strictly hex encoded (starting with 0x) signature of `serializedData`.
   * @param {function} verificationFn Optional verification function. Is called with the actual
   * signer and should throw when verification fails. The return value is ignored.
   * Default: Parse `serializedData` as JSON and compare the actual signer to checksum
   * address of the `signer` field.
   *
   * Default verification fn expects the `serializedData` is string containing JSON with `signer` field
   * Provide custom `verificationFn` if needed.
   *
   * @throws {TrustClueRuntimeError} When any of arguments is missing, or the signature recovery
   * fails or the signature verification fails or any other error occurs.
   */
  verifySignedData (serializedData, signature, verificationFn) {
    if (!serializedData) {
      throw new TrustClueRuntimeError('serializedData is missing.');
    }
    
    if (!signature || !Web3Utils.isHexStrict(signature)) {
      throw new TrustClueRuntimeError('signature is either missing or not hex encoded with 0x prefix.');
    }
    if (!verificationFn) {
      verificationFn = (_actualSigner) => {
        let data = JSON.parse(serializedData);
        let expectedSigner = data.signer;
        if (Web3Utils.toChecksumAddress(expectedSigner) !== _actualSigner) {
          throw new TrustClueRuntimeError(`Expected signer '${expectedSigner}' does not match the recovered one '${_actualSigner}'`);
        }
      };
    }

    try {
      const actualSigner = this.web3Eth.accounts.recover(serializedData, signature);
      try {
        verificationFn(actualSigner);
      } catch (e) {
        throw new TrustClueRuntimeError(`Verification function failed: ${e.toString()}`, e);
      }
    } catch (e) {
      throw new TrustClueRuntimeError(e);
    }
  }
}

export default TrustClueClient;
