import { assert } from 'chai';
import { WtJsLibs } from '../src/index';
import jsonWallet from './utils/test-wallet';
import jsonWallet2 from './utils/test-wallet-2';
import testedDataModel from './utils/data-hotel-model-definition';
import OffChainDataClient from '../src/off-chain-data-client';

import { InputDataError, WTLibsError } from '../src/errors';

describe('WtJsLibs usage', () => {
  let libs, wallet, index, emptyIndex, minedTxHashes = [],
    hotelManager = '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906';

  beforeEach(() => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
    index = libs.getWTIndex(testedDataModel.indexAddress);
    wallet = libs.createWallet(jsonWallet);
    emptyIndex = libs.getWTIndex(testedDataModel.emptyIndexAddress);
    wallet.unlock('test123');
  });

  afterEach(() => {
    wallet.destroy();
    OffChainDataClient._reset();
  });

  describe('addHotel', () => {
    it('should add hotel', async () => {
      const jsonClient = libs.getOffChainDataClient('in-memory');
      const descUrl = await jsonClient.upload({
        name: 'Premium hotel',
        description: 'Great hotel',
        location: {
          latitude: 'lat',
          longitude: 'long',
        },
      });
      const dataUri = await jsonClient.upload({
        descriptionUri: descUrl,
      });
      const createHotel = await index.addHotel({
        manager: hotelManager,
        dataUri: dataUri,
      });
      const hotel = createHotel.hotel;
      const result = await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);

      assert.isDefined(result);
      assert.isDefined(hotel.address);
      assert.isDefined(result.transactionHash);

      // Prepare getTransactionsStatus test
      minedTxHashes.push(result.transactionHash);
      // Don't bother with checksummed address format
      assert.equal((await hotel.manager), hotelManager);
      assert.equal((await hotel.dataUri).toLowerCase(), dataUri);
      const dataIndex = await hotel.dataIndex;
      const description = (await dataIndex.contents).descriptionUri;
      assert.equal((await description.contents).name, 'Premium hotel');

      // We're removing the hotel to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain WTIndex after each test.
      const removeHotel = await index.removeHotel(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      assert.equal(removalTxResults.meta.allPassed, true);
    });

    it('should throw when hotel does not have a manager', async () => {
      try {
        await index.addHotel({
          dataUri: 'in-memory://some-data-hash',
        });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot add hotel/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should throw when hotel does not have a dataUri', async () => {
      try {
        await index.addHotel({
          manager: hotelManager,
        });
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot add hotel/i);
        assert.instanceOf(e, InputDataError);
      }
    });
  });

  describe('removeHotel', () => {
    it('should remove hotel', async () => {
      const manager = hotelManager;
      const createHotel = await index.addHotel({
        dataUri: 'in-memory://some-data-hash',
        manager: manager,
      });
      const origHotel = createHotel.hotel;
      await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);
      assert.isDefined(origHotel.address);

      // Verify that it has been added
      let list = (await index.getAllHotels());
      assert.equal(list.length, 3);
      assert.include(await Promise.all(list.map(async (a) => a.address)), origHotel.address);
      const hotel = await index.getHotel(origHotel.address);
      // Remove
      const removeHotel = await index.removeHotel(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      assert.isDefined(removalResult);
      // prepare getTransactionsStatus test
      minedTxHashes.push(removalResult.transactionHash);
      // Verify that it has been removed
      list = await index.getAllHotels();
      assert.equal(list.length, 2);
      assert.notInclude(list.map(async (a) => a.address), await hotel.address);
    });

    it('should throw if hotel has no address', async () => {
      try {
        const hotel = await index.getHotel('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
        hotel.address = undefined;
        await index.removeHotel(hotel);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot remove hotel/i);
        assert.match(e.message, /without address/i);
        assert.instanceOf(e, InputDataError);
      }
    });
  });

  describe('getHotel', () => {
    it('should get hotel', async () => {
      const address = '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769';
      const hotel = await index.getHotel(address);
      assert.isNotNull(hotel);
      assert.equal(await hotel.dataUri, 'in-memory://hotel-url-one');
      assert.equal(await hotel.address, address);
    });

    it('should provide an initialized dataIndex', async () => {
      const address = '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769';
      const hotel = await index.getHotel(address);
      assert.isNotNull(hotel);
      const hotelDataIndex = await hotel.dataIndex;
      assert.equal(hotelDataIndex.ref, await hotel.dataUri);
      assert.isDefined(hotelDataIndex.contents);
      const hotelDataContents = (await hotelDataIndex.contents);
      const descriptionContents = hotelDataContents.descriptionUri;
      assert.isDefined(descriptionContents.contents);
      assert.isDefined(descriptionContents.ref);
      assert.equal((await descriptionContents.contents).name, 'First hotel');
      assert.equal(descriptionContents.ref, 'in-memory://hotel-description-one');
      const ratePlanContents = hotelDataContents.ratePlansUri;
      assert.isDefined(ratePlanContents.contents);
      assert.isDefined(ratePlanContents.ref);
      let ratePlans = await ratePlanContents.contents;
      assert.isArray(ratePlans);
      assert.equal(ratePlans[0].name, 'Basic');
      assert.equal(ratePlanContents.ref, 'in-memory://hotel-rateplans-one');
    });

    it('should provide a toPlainObject method', async () => {
      const hotel = await index.getHotel('0xbf18b616ac81830dd0c5d4b771f22fd8144fe769');
      assert.isNotNull(hotel);
      assert.isDefined(hotel.toPlainObject);
      const plainHotel = await hotel.toPlainObject();
      assert.isUndefined(plainHotel.toPlainObject);
      assert.equal(plainHotel.address, await hotel.address);
      assert.equal(plainHotel.manager, await hotel.manager);
      assert.isDefined(plainHotel.dataUri.contents.descriptionUri);
      assert.isDefined(plainHotel.dataUri.contents.descriptionUri.contents);
      assert.isDefined(plainHotel.dataUri.contents.descriptionUri.contents.location);
      assert.equal(plainHotel.dataUri.contents.descriptionUri.contents.name, 'First hotel');
      assert.isDefined(plainHotel.dataUri.contents.ratePlansUri);
      let ratePlans = await plainHotel.dataUri.contents.ratePlansUri.contents;
      assert.isArray(ratePlans);
      assert.equal(ratePlans[1].name, 'More expensive');
    });

    it('should throw if no hotel is found on given address', async () => {
      try {
        await index.getHotel('0x96eA4BbF71FEa3c9411C1Cefc555E9d7189695fA');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot find hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });
  });

  describe('updateHotel', () => {
    const hotelAddress = '0xbf18b616ac81830dd0c5d4b771f22fd8144fe769';

    it('should update hotel', async () => {
      const newUri = 'in-memory://another-url';
      const hotel = await index.getHotel(hotelAddress);
      const oldUri = await hotel.dataUri;
      hotel.dataUri = newUri;
      // Change the data
      const updateHotelSet = await index.updateHotel(hotel);
      let updateResult;
      for (let updateHotel of updateHotelSet) {
        updateResult = await wallet.signAndSendTransaction(updateHotel.transactionData, updateHotel.eventCallbacks);
        assert.isDefined(updateResult);
      }
      // Verify
      const hotel2 = await index.getHotel(hotelAddress);
      assert.equal(await hotel2.dataUri, newUri);
      // Change it back to keep data in line
      hotel.dataUri = oldUri;
      const updateHotelSet2 = await index.updateHotel(hotel);
      for (let updateHotel of updateHotelSet2) {
        updateResult = await wallet.signAndSendTransaction(updateHotel.transactionData, updateHotel.eventCallbacks);
        assert.isDefined(updateResult);
      }
      // Verify it changed properly
      const hotel3 = await index.getHotel(hotelAddress);
      assert.equal(await hotel3.dataUri, oldUri);
    });

    it('should throw if hotel has no address', async () => {
      try {
        const newUri = 'in-memory://another-random-hash';
        const hotel = await index.getHotel(hotelAddress);
        hotel.dataUri = newUri;
        hotel.address = undefined;
        await index.updateHotel(hotel);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.match(e.message, /without address/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should throw if hotel has no dataUri', async () => {
      try {
        const hotel = await index.getHotel(hotelAddress);
        hotel.dataUri = undefined;
        await index.updateHotel(hotel);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.match(e.message, /cannot set dataUri when it is not provided/i);
        assert.instanceOf(e, InputDataError);
      }
    });

    it('should throw if hotel does not exist on network', async () => {
      try {
        const hotel = {
          address: '0xcd2a3d9f938e13cd947ec05abc7fe734df8dd826',
          dataUri: 'in-memory://another-random-hash',
        };
        await index.updateHotel(hotel);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot update hotel/i);
        assert.instanceOf(e, WTLibsError);
      }
    });
  });

  describe('transferHotelOwnership', () => {
    const hotelAddress = '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769',
      newHotelOwner = '0x04e46F24307E4961157B986a0b653a0D88F9dBd6';

    it('should transfer hotel', async () => {
      const hotel = await index.getHotel(hotelAddress);
      const hotelContract = await hotel._getContractInstance();

      assert.equal(await hotel.manager, hotelManager);
      assert.equal(await hotelContract.methods.manager().call(), hotelManager);
      
      const updateHotel = await index.transferHotelOwnership(hotel, newHotelOwner);
      await wallet.signAndSendTransaction(updateHotel.transactionData, updateHotel.eventCallbacks);
      // Verify
      const hotel2 = await index.getHotel(hotelAddress);
      const hotel2Contract = await hotel2._getContractInstance();
      assert.equal(await hotel2.manager, newHotelOwner);
      assert.equal(await hotel2Contract.methods.manager().call(), newHotelOwner);
      
      // Change it back to keep data in line
      const updateHotel2 = await index.transferHotelOwnership(hotel, hotelManager);
      const wallet2 = libs.createWallet(jsonWallet2);
      wallet2.unlock('test123');
      await wallet2.signAndSendTransaction(updateHotel2.transactionData, updateHotel2.eventCallbacks);
      // Verify
      const hotel3 = await index.getHotel(hotelAddress);
      const hotel3Contract = await hotel3._getContractInstance();
      assert.equal(await hotel3.manager, hotelManager);
      assert.equal(await hotel3Contract.methods.manager().call(), hotelManager);
    });
  });

  describe('getAllHotels', () => {
    it('should get all hotels', async () => {
      const hotels = await index.getAllHotels();
      assert.equal(hotels.length, 2);
      for (let hotel of hotels) {
        assert.isDefined(hotel.toPlainObject);
        assert.isDefined((await hotel.dataIndex).ref);
        const plainHotel = await hotel.toPlainObject();
        assert.equal(plainHotel.address, await hotel.address);
        assert.equal(plainHotel.manager, await hotel.manager);
        assert.isDefined(plainHotel.dataUri.ref);
        assert.isDefined(plainHotel.dataUri.contents);
      }
    });

    it('should get empty list if no hotels are set', async () => {
      const hotels = await emptyIndex.getAllHotels();
      assert.equal(hotels.length, 0);
    });
  });

  describe('getTransactionsStatus', () => {
    // This unfortunately depends on other tests - to
    // make this isolated, we would have to run some transactions
    // beforehand
    it('should return transaction status', async () => {
      let result = await libs.getTransactionsStatus(minedTxHashes);
      assert.isDefined(result.meta);
      assert.equal(result.meta.total, minedTxHashes.length);
      assert.equal(result.meta.processed, minedTxHashes.length);
      assert.equal(result.meta.allPassed, true);
      for (let hash of minedTxHashes) {
        assert.isDefined(result.results[hash]);
        assert.isDefined(result.results[hash].transactionHash);
        assert.isDefined(result.results[hash].from);
        assert.isDefined(result.results[hash].to);
        assert.isDefined(result.results[hash].blockAge);
        assert.isDefined(result.results[hash].decodedLogs);
        assert.isDefined(result.results[hash].raw);
      }
    });

    it('should return nothing if transactions do not exist', async () => {
      let result = await libs.getTransactionsStatus(['random-tx', 'another-random-tx']);
      assert.isDefined(result.meta);
      assert.equal(result.meta.total, 2);
      assert.equal(result.meta.processed, 0);
      assert.equal(result.meta.allPassed, false);
      assert.deepEqual(result.results, {});
    });
  });

  it('should throw on unknown segment', () => {
    try {
      WtJsLibs.createInstance({ segment: 'books' });
      throw new Error('should not have been called');
    } catch (e) {
      assert.match(e.message, /Unknown segment: books/i);
      assert.instanceOf(e, Error);
    }
  });
});
