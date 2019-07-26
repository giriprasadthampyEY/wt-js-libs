import SegmentDirectoryMetadata from '@windingtree/wt-contracts/build/contracts/AbstractSegmentDirectory.json';
import OrganizationInterfaceMetadata from '@windingtree/wt-contracts/build/contracts/OrganizationInterface.json';
import OrganizationMetadata from '@windingtree/wt-contracts/build/contracts/Organization.json';
import OrganizationFactoryMetadata from '@windingtree/wt-contracts/build/contracts/AbstractOrganizationFactory.json';
import EntrypointMetadata from '@windingtree/wt-contracts/build/contracts/WindingTreeEntrypoint.json';
import { SmartContractInstantiationError } from './errors';

import Web3Utils from 'web3-utils';
import Web3Eth from 'web3-eth';

/**
 * Wrapper class for work with Winding Tree's Ethereum
 * smart contracts.
 */
export class Contracts {
  /**
   * Returns an initialized instance
   *
   * @param  {string|Object} web3 provider used to initialize web3-eth
   * @return {Contracts}
   */
  static createInstance (provider) {
    return new Contracts(provider);
  }

  constructor (provider) {
    this.provider = provider;
    this.web3Eth = new Web3Eth(provider);
    this.contractsCache = {};
  }

  /**
   * Generic method for getting an instance of `web3.eth.Contract`.
   * Contracts are cached in memory based on the combination of name
   * and address.
   *
   * @param  {string} name of contract, used in errors
   * @param  {Object} abi specification of contract
   * @param  {string} address on which we should look for the contract
   * @throws {SmartContractInstantiationError} When address is invalid
   * @throws {SmartContractInstantiationError} When no code is deployed on given address
   * @return {web3.eth.Contract} Resulting wrapper contract
   */
  async _getInstance (name, abi, address) {
    if (!Web3Utils.isAddress(address)) {
      throw new SmartContractInstantiationError('Cannot get ' + name + ' instance at an invalid address ' + address);
    }
    if (!this.contractsCache[`${name}:${address}`]) {
      const deployedCode = await this.web3Eth.getCode(address);
      if (deployedCode === '0x0' || deployedCode === '0x') {
        throw new SmartContractInstantiationError('Cannot get ' + name + ' instance at an address with no code on ' + address);
      }
      this.contractsCache[`${name}:${address}`] = new this.web3Eth.Contract(abi, address);
    }
    return this.contractsCache[`${name}:${address}`];
  }

  async getSegmentDirectoryInstance (address) {
    return this._getInstance('segmentDirectory', SegmentDirectoryMetadata.abi, address);
  }

  async getOrganizationInstance (address) {
    return this._getInstance('organization', OrganizationInterfaceMetadata.abi, address);
  }

  async getUpdateableOrganizationInstance (address) {
    return this._getInstance('organization', OrganizationMetadata.abi, address);
  }

  async getOrganizationFactoryInstance (address) {
    return this._getInstance('organizationFactory', OrganizationFactoryMetadata.abi, address);
  }

  async getEntrypointInstance (address) {
    return this._getInstance('entrypoint', EntrypointMetadata.abi, address);
  }

  _initEventRegistry () {
    function generateEventSignatures (abi) {
      const events = abi.filter((m) => m.type === 'event');
      const indexedEvents = {};
      for (const event of events) {
        // kudos https://github.com/ConsenSys/abi-decoder/blob/master/index.js#L19
        const signature = Web3Utils.sha3(event.name + '(' + event.inputs.map(function (input) { return input.type; }).join(',') + ')');
        indexedEvents[signature] = event;
      }
      return indexedEvents;
    }
    if (!this.eventRegistry) {
      this.eventRegistry = Object.assign(
        {},
        generateEventSignatures(OrganizationInterfaceMetadata.abi),
        generateEventSignatures(OrganizationFactoryMetadata.abi),
        generateEventSignatures(SegmentDirectoryMetadata.abi),
        generateEventSignatures(EntrypointMetadata.abi),
      );
    }
    return this.eventRegistry;
  }

  /**
   * Decodes ethereum transaction log values. Currently supports
   * events from Directory and Hotel smart contracts.
   *
   * @param  {Array<RawLogRecordInterface>} logs in a raw format
   * @return {Array<DecodedLogRecordInterface>} Decoded logs
   */
  decodeLogs (logs) {
    const result = [];
    const eventRegistry = this._initEventRegistry();
    for (const log of logs) {
      if (log.topics && log.topics[0] && eventRegistry[log.topics[0]]) {
        const eventAbi = eventRegistry[log.topics[0]];
        let topics = log.topics;
        // @see https://web3js.readthedocs.io/en/1.0/web3-eth-abi.html#id22
        if (!eventAbi.anonymous) {
          topics = log.topics.slice(1);
        }
        const decoded = this.web3Eth.abi.decodeLog(eventAbi.inputs, log.data, topics);
        const parsedAttributes = eventAbi.inputs.map((input) => {
          return {
            name: input.name,
            type: input.type,
            value: decoded[input.name],
          };
        });
        result.push({
          event: eventAbi.name,
          address: log.address,
          attributes: parsedAttributes,
        });
      }
    }
    return result;
  }
}
export default Contracts;
