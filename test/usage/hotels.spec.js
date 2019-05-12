import { assert } from 'chai';
import { WtJsLibs } from '../../src/index';
import jsonWallet from '../utils/test-wallet';
import jsonWallet2 from '../utils/test-wallet-2';
import testedDataModel from '../utils/data-hotel-model-definition';
import OffChainDataClient from '../../src/off-chain-data-client';

describe('WtJsLibs usage - hotels', () => {
  let libs, wallet, index, emptyIndex,
    hotelManager = '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906';

  beforeEach(() => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
    index = libs.getWTIndex('hotels', testedDataModel.indexAddress);
    wallet = libs.createWallet(jsonWallet);
    emptyIndex = libs.getWTIndex('hotels', testedDataModel.emptyIndexAddress);
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

      // Don't bother with checksummed address format
      assert.equal((await hotel.manager), hotelManager);
      assert.equal((await hotel.dataUri).toLowerCase(), dataUri);
      assert.equal((await hotel.created), 20);
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
      // Verify that it has been removed
      list = await index.getAllHotels();
      assert.equal(list.length, 2);
      assert.notInclude(list.map(async (a) => a.address), await hotel.address);
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
});
