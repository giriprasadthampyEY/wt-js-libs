import { assert } from 'chai';
import { WtJsLibs } from '../../src/index';
import jsonWallet from '../utils/test-wallet';
import testedDataModel from '../utils/data-hotel-model-definition';
import OffChainDataClient from '../../src/off-chain-data-client';

describe('WtJsLibs usage - hotels', () => {
  let libs, wallet, directory, emptyDirectory;
  const hotelOwner = '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906';
  const hotelAddress = '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769';

  beforeEach(() => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
    directory = libs.getDirectory('hotels', testedDataModel.directoryAddress);
    wallet = libs.createWallet(jsonWallet);
    emptyDirectory = libs.getDirectory('hotels', testedDataModel.emptyDirectoryAddress);
    wallet.unlock('test123');
  });

  afterEach(() => {
    wallet.destroy();
    OffChainDataClient._reset();
  });

  describe('segment', () => {
    it('should get correct segment', async () => {
      const segment = await directory.getSegment({
        from: hotelOwner,
      });
      assert.equal(segment, 'hotels');
    });
  });

  describe('create and add', () => {
    it('should create and add hotel', async () => {
      const jsonClient = libs.getOffChainDataClient('in-memory');
      // hotel description
      const descUrl = await jsonClient.upload({
        name: 'Premium hotel',
        description: 'Great hotel',
        location: {
          latitude: 'lat',
          longitude: 'long',
        },
      });
      // ORG.ID json
      const orgJsonUri = await jsonClient.upload({
        descriptionUri: descUrl,
      });
      const createHotel = await directory.createAndAdd({
        owner: hotelOwner,
        orgJsonUri: orgJsonUri,
      });
      const hotel = createHotel.hotel;
      const result = await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);

      assert.isDefined(result);
      assert.isDefined(hotel.address);
      assert.isDefined(result.transactionHash);

      // Don't bother with checksummed address format
      assert.equal((await hotel.owner), hotelOwner);
      assert.equal((await hotel.orgJsonUri).toLowerCase(), orgJsonUri);
      assert.equal((await hotel.created), 21);
      const dataIndex = await hotel.dataIndex;
      const description = (await dataIndex.contents).descriptionUri;
      assert.equal((await description.contents).name, 'Premium hotel');

      // We're removing the hotel to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain directory after each test.
      const removeHotel = await directory.remove(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      // TODO decode logs
      // const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      // assert.equal(removalTxResults.meta.allPassed, true);
    });

    it('should create then add hotel', async () => {
      const jsonClient = libs.getOffChainDataClient('in-memory');
      const descUrl = await jsonClient.upload({
        name: 'Premium hotel',
        description: 'Great hotel',
        location: {
          latitude: 'lat',
          longitude: 'long',
        },
      });
      const orgJsonUri = await jsonClient.upload({
        descriptionUri: descUrl,
      });
      const createHotel = await directory.create({
        owner: hotelOwner,
        orgJsonUri: orgJsonUri,
      });
      const hotel = createHotel.hotel;
      const result = await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);

      assert.isDefined(result);
      assert.isDefined(hotel.address);
      assert.isDefined(result.transactionHash);

      const addHotel = await directory.add(hotel);
      await wallet.signAndSendTransaction(addHotel.transactionData, addHotel.eventCallbacks);

      // verify
      let list = (await directory.getRecords());
      assert.equal(list.length, 3);

      // We're removing the hotel to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain directory after each test.
      const removeHotel = await directory.remove(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      // TODO decode logs
      // const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      // assert.equal(removalTxResults.meta.allPassed, true);
    });
  });

  describe('remove', () => {
    it('should remove hotel', async () => {
      const owner = hotelOwner;
      const createHotel = await directory.createAndAdd({
        orgJsonUri: 'in-memory://some-data-hash',
        owner: owner,
      });
      const origHotel = createHotel.hotel;
      await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);
      assert.isDefined(origHotel.address);

      // Verify that it has been added
      let list = (await directory.getRecords());
      assert.equal(list.length, 3);
      assert.include(await Promise.all(list.map(async (a) => a.address)), origHotel.address);
      const hotel = await directory.getRecord(origHotel.address);
      // Remove
      const removeHotel = await directory.remove(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      assert.isDefined(removalResult);
      // Verify that it has been removed
      list = await directory.getRecords();
      assert.equal(list.length, 2);
      assert.notInclude(list.map(async (a) => a.address), await hotel.address);
    });
  });

  describe('getRecord', () => {
    it('should get hotel', async () => {
      const hotel = await directory.getRecord(hotelAddress);
      assert.isNotNull(hotel);
      assert.equal(await hotel.orgJsonUri, 'in-memory://hotel-url-one');
      assert.equal(await hotel.address, hotelAddress);
    });
  });

  describe('update', () => {
    it('should update hotel', async () => {
      const newUri = 'in-memory://another-url';
      const hotel = await directory.getRecord(hotelAddress);
      const oldUri = await hotel.orgJsonUri;
      hotel.orgJsonUri = newUri;
      // Change the data
      const updateHotelSet = await directory.update(hotel);
      let updateResult;
      for (let updateHotel of updateHotelSet) {
        updateResult = await wallet.signAndSendTransaction(updateHotel.transactionData, updateHotel.eventCallbacks);
        assert.isDefined(updateResult);
      }
      // Verify
      const hotel2 = await directory.getRecord(hotelAddress);
      assert.equal(await hotel2.orgJsonUri, newUri);
      // Change it back to keep data in line
      hotel.orgJsonUri = oldUri;
      const updateHotelSet2 = await directory.update(hotel);
      for (let updateHotel of updateHotelSet2) {
        updateResult = await wallet.signAndSendTransaction(updateHotel.transactionData, updateHotel.eventCallbacks);
        assert.isDefined(updateResult);
      }
      // Verify it changed properly
      const hotel3 = await directory.getRecord(hotelAddress);
      assert.equal(await hotel3.orgJsonUri, oldUri);
    });
  });

  describe('getRecords', () => {
    it('should get all hotels', async () => {
      const hotels = await directory.getRecords();
      assert.equal(hotels.length, 2);
      for (let hotel of hotels) {
        assert.isDefined(hotel.toPlainObject);
        assert.isDefined((await hotel.dataIndex).ref);
        const plainHotel = await hotel.toPlainObject();
        assert.equal(plainHotel.address, await hotel.address);
        assert.equal(plainHotel.owner, await hotel.owner);
        assert.isDefined(plainHotel.orgJsonUri.ref);
        assert.isDefined(plainHotel.orgJsonUri.contents);
      }
    });

    it('should get empty list if no hotels are set', async () => {
      const hotels = await emptyDirectory.getRecords();
      assert.equal(hotels.length, 0);
    });
  });

  describe('owner', () => {
    it('should get owner', async () => {
      const hotel = await directory.getRecord(hotelAddress);
      assert.isNotNull(hotel);
      assert.equal(await hotel.owner, hotelOwner);
    });
  });

  describe('hasDelegate', () => {
    const delegateAddress = '0x04e46F24307E4961157B986a0b653a0D88F9dBd6';

    it('should return true if is delegate', async () => {
      const hotel = await directory.getRecord(hotelAddress);
      const hasDelegate = await hotel.hasDelegate(delegateAddress, {
        from: hotelOwner,
      });
      assert.equal(hasDelegate, true);
    });

    it('should return true if is delegate whoever asks', async () => {
      const hotel = await directory.getRecord(hotelAddress);
      const hasDelegate = await hotel.hasDelegate(delegateAddress, {
        from: delegateAddress,
      });
      assert.equal(hasDelegate, true);
    });

    it('should return false if is not delegate', async () => {
      const hotel = await directory.getRecord(hotelAddress);
      const hasDelegate = await hotel.hasDelegate(hotelOwner, {
        from: hotelOwner,
      });
      assert.equal(hasDelegate, false);
    });

    it('should return false if is not delegate whoever asks', async () => {
      const hotel = await directory.getRecord(hotelAddress);
      const hasDelegate = await hotel.hasDelegate(hotelOwner, {
        from: delegateAddress,
      });
      assert.equal(hasDelegate, false);
    });
  });
});
