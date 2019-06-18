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

  xdescribe('create and add', () => {
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
      assert.isDefined(await hotel.created);
      const dataIndex = await hotel.dataIndex;
      const description = (await dataIndex.contents).descriptionUri;
      assert.equal((await description.contents).name, 'Premium hotel');

      // We're removing the hotel to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain directory after each test.
      const removeHotel = await directory.remove(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      assert.equal(removalTxResults.meta.allPassed, true);
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
      let list = (await directory.getOrganizations());
      assert.equal(list.length, 3);

      // We're removing the hotel to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain directory after each test.
      const removeHotel = await directory.remove(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      assert.equal(removalTxResults.meta.allPassed, true);
    });
  });

  xdescribe('remove', () => {
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
      let list = (await directory.getOrganizations());
      assert.equal(list.length, 3);
      assert.include(await Promise.all(list.map(async (a) => a.address)), origHotel.address);
      const hotel = await directory.getOrganization(origHotel.address);
      // Remove
      const removeHotel = await directory.remove(hotel);
      const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
      assert.isDefined(removalResult);
      // Verify that it has been removed
      list = await directory.getOrganizations();
      assert.equal(list.length, 2);
      assert.notInclude(list.map(async (a) => a.address), await hotel.address);
    });
  });

  describe('getOrganization', () => {
    it('should get hotel by address', async () => {
      const hotel = await directory.getOrganization(hotelAddress);
      assert.isNotNull(hotel);
      assert.equal(await hotel.orgJsonUri, 'in-memory://hotel-url-one');
      assert.equal(await hotel.address, hotelAddress);
    });

    it('should get hotel index by address', async () => {
      const idx = await directory.getOrganizationIndex(hotelAddress);
      assert.equal(idx, 1);
    });

    it('should get hotel by index', async () => {
      const firstHotel = await directory.getOrganizationByIndex(1);
      assert.isNotNull(firstHotel);
      assert.equal(await firstHotel.orgJsonUri, 'in-memory://hotel-url-one');
      assert.equal(await firstHotel.address, hotelAddress);
      const secondHotel = await directory.getOrganizationByIndex(2);
      assert.isNotNull(secondHotel);
      assert.equal(await secondHotel.orgJsonUri, 'in-memory://hotel-url-two');
      assert.equal(await secondHotel.address, '0x4A763F50DFe5cF4468B4171539E021A26FCee0cC');
    });
  });

  describe('getOrganizations', () => {
    it('should get all hotels', async () => {
      const hotels = await directory.getOrganizations();
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
      const hotels = await emptyDirectory.getOrganizations();
      assert.equal(hotels.length, 0);
    });
  });

  describe('owner', () => {
    it('should get owner', async () => {
      const hotel = await directory.getOrganization(hotelAddress);
      assert.isNotNull(hotel);
      assert.equal(await hotel.owner, hotelOwner);
    });
  });

  describe('hasAssociatedKey', () => {
    const associatedKeyAddress = '0x04e46F24307E4961157B986a0b653a0D88F9dBd6';

    it('should return true if is associatedKey', async () => {
      const hotel = await directory.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(associatedKeyAddress, {
        from: hotelOwner,
      });
      assert.equal(hasAssociatedKey, true);
    });

    it('should return true if is associatedKey whoever asks', async () => {
      const hotel = await directory.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(associatedKeyAddress, {
        from: '0xB309875d8b24D522Ea0Ac57903c8A0b0C93C414A',
      });
      assert.equal(hasAssociatedKey, true);
    });

    it('should return false if is not associatedKey', async () => {
      const hotel = await directory.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(hotelOwner, {
        from: hotelOwner,
      });
      assert.equal(hasAssociatedKey, false);
    });

    it('should return false if is not associatedKey whoever asks', async () => {
      const hotel = await directory.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(hotelOwner, {
        from: '0xB309875d8b24D522Ea0Ac57903c8A0b0C93C414A',
      });
      assert.equal(hasAssociatedKey, false);
    });
  });
});
