// @flow
import type { WTIndexInterface, HotelOnChainDataInterface, HotelInterface, AddHotelResponseInterface, WalletInterface } from '../interfaces';
import Utils from '../utils';
import Contracts from '../contracts';
import OnChainHotel from './on-chain-hotel';

/**
 * Ethereum smart contract backed implementation of Winding Tree
 * index wrapper. It provides methods for working with hotel
 * contracts.
 */
class WTIndex implements WTIndexInterface {
  address: string;
  web3Utils: Utils;
  web3Contracts: Contracts;
  deployedIndex: Object; // TODO get rid of Object type

  /**
   * Returns a configured instance of WTIndex
   * representing a Winding Tree index contract on a given `indexAddress`.
   */
  static async createInstance (indexAddress: string, web3Utils: Utils, web3Contracts: Contracts): Promise<WTIndex> {
    return new WTIndex(indexAddress, web3Utils, web3Contracts);
  }

  constructor (indexAddress: string, web3Utils: Utils, web3Contracts: Contracts) {
    this.address = indexAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async __getDeployedIndex (): Promise<Object> {
    if (!this.deployedIndex) {
      this.deployedIndex = await this.web3Contracts.getIndexInstance(this.address);
    }
    return this.deployedIndex;
  }

  async __createHotelInstance (address?: string): Promise<HotelInterface> {
    return OnChainHotel.createInstance(this.web3Utils, this.web3Contracts, await this.__getDeployedIndex(), address);
  }

  /**
   * Adds a totally new hotel on chain. Does not wait for the transactions
   * to be mined, but as fast as possible returns a list of transaction IDs
   * and the new hotel on chain address.
   *
   * @throws {Error} When hotelData does not contain dataUri property.
   * @throws {Error} When anything goes wrong during communication with the network.
   */
  async addHotel (wallet: WalletInterface, hotelData: HotelOnChainDataInterface): Promise<AddHotelResponseInterface> {
    if (!await hotelData.dataUri) {
      throw new Error('Cannot add hotel: Missing dataUri');
    }
    const hotelManager = await hotelData.manager;
    if (!hotelManager) {
      throw new Error('Cannot add hotel: Missing manager');
    }
    try {
      const hotel: HotelInterface = await this.__createHotelInstance();
      await hotel.setLocalData(hotelData);
      const transactionIds = await hotel.createOnChainData(wallet, {
        from: hotelManager,
      });
      return {
        address: await hotel.address,
        transactionIds: transactionIds,
      };
    } catch (err) {
      throw new Error('Cannot add hotel: ' + err.message);
    }
  }

  /**
   * Updates a hotel on chain. Does not wait for the transactions
   * to be mined, but as fast as possible returns a list of transaction
   * IDs so you can keep track of the progress.
   *
   * @throws {Error} When hotel does not have a manager field.
   * @throws {Error} When anything goes wrong during communication with the network.
   */
  async updateHotel (wallet: WalletInterface, hotel: HotelInterface): Promise<Array<string>> {
    try {
      if (!hotel.address) {
        throw new Error('Cannot update hotel without address.');
      }
      const hotelManager = await hotel.manager;
      if (!hotelManager) {
        throw new Error('Cannot update hotel without manager.');
      }
      // We need to separate calls to be able to properly catch exceptions
      const updatedHotel = await hotel.updateOnChainData(wallet, { // eslint-disable-line flowtype/no-weak-types
        from: hotelManager,
      });
      return updatedHotel;
    } catch (err) {
      throw new Error('Cannot update hotel:' + err.message);
    }
  }

  /**
   * Removes the hotel from chain. Does not wait for the transactions
   * to be mined, but as fast as possible returns a list of transaction
   * IDs so you can keep track of the progress.
   *
   * @throws {Error} When anything goes wrong such as
   *   - hotel does not exist
   *   - hotel does not belong to the calling manager
   *   - not enough gas
   */
  async removeHotel (wallet: WalletInterface, hotel: HotelInterface): Promise<Array<string>> {
    try {
      if (!hotel.address) {
        throw new Error('Cannot remove hotel without address.');
      }
      const hotelManager = await hotel.manager;
      if (!hotelManager) {
        throw new Error('Cannot remove hotel without manager.');
      }
      // We need to separate calls to be able to properly catch exceptions
      const result = await hotel.removeOnChainData(wallet, { // eslint-disable-line flowtype/no-weak-types
        from: hotelManager,
      });
      return result;
    } catch (err) {
      // invalid opcode -> non-existent hotel
      // invalid opcode -> failed check for manager
      throw new Error('Cannot remove hotel: ' + err.message);
    }
  }

  /**
   * Gets hotel representation of a hotel on a given address. If hotel
   * on such address is not registered through this Winding Tree index
   * instance, the method throws immediately.
   *
   * @throws {Error} When hotel does not exist.
   * @throws {Error} When something breaks in the network communication.
   */
  async getHotel (address: string): Promise<?HotelInterface> {
    const index = await this.__getDeployedIndex();
    try {
      // This returns strings
      const hotelIndex = parseInt(await index.methods.hotelsIndex(address).call(), 10);
      // Zeroeth position is reserved as empty during index deployment
      if (!hotelIndex) {
        throw new Error('Not found in hotel list');
      } else {
        const hotel = await this.__createHotelInstance(address);
        return hotel;
      }
    } catch (err) {
      throw new Error('Cannot find hotel at ' + address + ': ' + err.message);
    }
  }

  /**
   * Returns a list of all hotels. It will filter out
   * every hotel that is inaccessible for any reason.
   *
   * Currently does not provide any information on inaccessible
   * hotels. Subject to change.
   */
  async getAllHotels (): Promise<Array<HotelInterface>> {
    const index = await this.__getDeployedIndex();
    const hotelsAddressList = await index.methods.getHotels().call();
    let getHotelDetails = hotelsAddressList
      // Filtering null addresses beforehand improves efficiency
      .filter((addr: string): boolean => !this.web3Utils.isZeroAddress(addr))
      .map((addr: string): Promise<?HotelInterface> => {
        return this.getHotel(addr) // eslint-disable-line promise/no-nesting
          // We don't really care why the hotel is inaccessible
          // and we need to catch exceptions here on each individual hotel
          .catch((err: Error): null => {
            // TODO optional logging/improve error handling.
            if (err) {}
            return null;
          });
      });
    const hotelDetails: Array<?HotelInterface> = await (Promise.all(getHotelDetails): any); // eslint-disable-line flowtype/no-weak-types
    const hotelList: Array<HotelInterface> = (hotelDetails.filter((a: ?HotelInterface): boolean => a != null): any); // eslint-disable-line flowtype/no-weak-types
    return hotelList;
  }
}

export default WTIndex;
