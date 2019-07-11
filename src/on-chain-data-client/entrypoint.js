import SegmentDirectory from './segment-directory';
import OrganizationFactory from './organization-factory';
import { OnChainDataRuntimeError } from './errors';

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

  getSegments () {

  }

  async getSegmentAddress (segment) {
    const contract = await this._getDeployedEntrypoint();
    return contract.methods.getSegment(segment).call();
  }

  getOwner () {

  }

  getLifTokenAddress () {

  }

  async getSegmentDirectory (segment) {
    if (!this._segmentAddresses[segment]) {
      const address = await this.getSegmentAddress(segment);
      if (!address) { // TODO test for zero address
        throw new OnChainDataRuntimeError(`Cannot find segment ${segment} in entrypoint at ${this.address}`);
      }
      this._segmentAddresses[segment] = address;
    }
    return this._getCachedInstance(this._segmentAddresses[segment], SegmentDirectory);
  }

  async getOrganizationFactory (address) {
    if (!this._factoryAddress) {
      const contract = await this._getDeployedEntrypoint();
      const address = await contract.methods.getOrganizationFactory().call();
      if (!address) { // TODO test for zero address
        throw new OnChainDataRuntimeError(`Cannot find organization factory in entrypoint at ${this.address}`);
      }
      this._factoryAddress = address;
    }
    return this._getCachedInstance(this._factoryAddress, OrganizationFactory);
  }
}

export default Entrypoint;
