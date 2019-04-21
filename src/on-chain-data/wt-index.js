// @flow

import Utils from './utils';
import Contracts from './contracts';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * index wrapper. It provides methods for working with hotel
 * contracts.
 */
export default class AbstractWTIndex {
  address: string;
  web3Utils: Utils;
  web3Contracts: Contracts;
  deployedIndex: Object; // TODO get rid of Object type
}
