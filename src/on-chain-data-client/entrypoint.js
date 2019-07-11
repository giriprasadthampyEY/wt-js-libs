import SegmentDirectory from './segment-directory';
import OrganizationFactory from './organization-factory';
import { OnChainDataRuntimeError } from './errors';

/**
 * A wrapper class for Winding Tree entrypoint.
 */
export class Entrypoint {
  static createInstance (entrypointAddress, web3Utils, web3Contracts) {
    return new Entrypoint(entrypointAddress, web3Utils, web3Contracts);
  }

  constructor (entrypointAddress, web3Utils, web3Contracts) {
    this.address = entrypointAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
    this._segmentAddresses = {};
    this._cache = {};
    this._factoryAddress = undefined;
    this._deployedEntrypoint = undefined;
  }

  async _getDeployedEntrypoint () {
    if (!this._deployedEntrypoint) {
      this._deployedEntrypoint = await this.web3Contracts.getEntrypointInstance(this.address);
    }
    return this._deployedEntrypoint;
  }

  _getCachedInstance (address, klass) {
    if (!this._cache[address]) {
      this._cache[address] = klass.createInstance(address, this.web3Utils, this.web3Contracts);
    }
    return this._cache[address];
  }

  /**
   * Returns list of all registered segments. Does not return empty records.
   */
  async getSegments () {
    const contract = await this._getDeployedEntrypoint();
    const length = await contract.methods.getSegmentsLength().call();
    const segments = [];
    // intentionally skipping the first null record
    for (let i = 1; i < length; i++) {
      segments.push(contract.methods.getSegmentName(i).call());
    }
    return Promise.all(segments).then((results) => {
      // filter out empty spots
      return results.filter(s => !!s);
    });
  }

  async getOwner () {
    const contract = await this._getDeployedEntrypoint();
    return contract.methods.owner().call();
  }

  async getLifTokenAddress () {
    const contract = await this._getDeployedEntrypoint();
    return contract.methods.LifToken().call();
  }

  /**
   * Fetches an address of a segment. Does not cache, always calls
   * a smart contract!
   * @param  {string} segment
   * @return {string} address
   */
  async getSegmentAddress (segment) {
    const contract = await this._getDeployedEntrypoint();
    return contract.methods.getSegment(segment).call();
  }

  /**
   * Gets address of a segment from the entrypoint
   * and returns SegmentDirectory abstraction.
   */
  async getSegmentDirectory (segment) {
    if (!this._segmentAddresses[segment]) {
      const address = await this.getSegmentAddress(segment);
      if (this.web3Utils.isZeroAddress(address)) {
        throw new OnChainDataRuntimeError(`Cannot find segment ${segment} in entrypoint at ${this.address}`);
      }
      this._segmentAddresses[segment] = address;
    }
    return this._getCachedInstance(this._segmentAddresses[segment], SegmentDirectory);
  }

  /**
   * Gets address of organization factory from the entrypoint
   * and returns OrganizationFactory abstraction.
   */
  async getOrganizationFactory (address) {
    if (!this._factoryAddress) {
      const contract = await this._getDeployedEntrypoint();
      const address = await contract.methods.getOrganizationFactory().call();
      if (this.web3Utils.isZeroAddress(address)) {
        throw new OnChainDataRuntimeError(`Cannot find organization factory in entrypoint at ${this.address}`);
      }
      this._factoryAddress = address;
    }
    return this._getCachedInstance(this._factoryAddress, OrganizationFactory);
  }
}

export default Entrypoint;
