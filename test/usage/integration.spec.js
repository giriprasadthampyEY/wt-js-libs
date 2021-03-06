import { assert } from 'chai';
import { WtJsLibs } from '../../src/index';
import jsonWallet from '../utils/test-wallet';
import testedDataModel from '../utils/data-hotel-model-definition';
import web3utils from 'web3-utils';
import OffChainDataClient from '../../src/off-chain-data-client';

describe('WtJsLibs usage - hotels', () => {
  let libs, wallet, entrypoint, directory, factory;
  const hotelOwner = '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906';
  const hotelAddress = '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769';

  beforeEach(async () => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
    wallet = libs.createWallet(jsonWallet);
    entrypoint = libs.getEntrypoint(testedDataModel.entrypointAddress);
    factory = await entrypoint.getOrganizationFactory();
    directory = await entrypoint.getSegmentDirectory('hotels');
    wallet.unlock('test123');
  });

  afterEach(() => {
    wallet.destroy();
    OffChainDataClient._reset();
  });

  it('create and add, update and remove a hotel', async () => {
    const jsonClient = libs.getOffChainDataClient('in-memory');
    // hotel description
    const descUri = await jsonClient.upload(JSON.stringify({
      name: 'Premium hotel',
      description: 'Great hotel',
      location: {
        latitude: 'lat',
        longitude: 'long',
      },
    }));
    const dataUri = await jsonClient.upload(JSON.stringify({
      descriptionUri: descUri,
    }));
      // ORG.ID json
    const orgJsonData = JSON.stringify({
      dataFormatVersion: '0.0.0',
      name: 'Premium hotel',
      hotel: {
        name: 'Premium hotel',
        apis: [
          {
            entrypoint: dataUri,
            format: 'windingtree',
          },
          {
            entrypoint: 'http://dummy.restapiexample.com/api/v1/employees',
            format: 'coolapi',
          },
        ],
      },
    });
    const orgJsonUri = await jsonClient.upload(orgJsonData);
    const createHotel = await factory.createAndAddOrganization({
      owner: hotelOwner,
      orgJsonUri: orgJsonUri,
      orgJsonHash: web3utils.soliditySha3(orgJsonData),
    }, directory.address);
    const result = await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);
    const hotel = await createHotel.organization;

    assert.isDefined(result);
    assert.isDefined(hotel.address);
    assert.isDefined(result.transactionHash);

    // verify
    let list = (await directory.getOrganizations());
    assert.equal(list.length, 3);

    // Don't bother with checksummed address format
    assert.equal((await hotel.owner), hotelOwner);
    assert.equal((await hotel.orgJsonUri).toLowerCase(), orgJsonUri);
    const apiPointer = (await hotel.getWindingTreeApi()).hotel[0];
    assert.isDefined(apiPointer);
    assert.equal((await apiPointer.toPlainObject()).contents.descriptionUri.contents.name, 'Premium hotel');

    // update
    hotel.orgJsonUri = 'https://example.com';
    const updateHotel = await hotel.updateOnChainData({
      from: hotelOwner,
    });
    for (let i = 0; i < updateHotel.length; i++) {
      const updateResult = await wallet.signAndSendTransaction(updateHotel[i].transactionData, updateHotel[i].eventCallbacks);
      assert.isDefined(updateResult);
      assert.isDefined(updateResult.transactionHash);
    }
    const standaloneHotel = libs.getUpdateableOrganization(hotel.address);
    assert.equal((await standaloneHotel.orgJsonUri).toLowerCase(), 'https://example.com');

    // We're removing the hotel to ensure clean slate after this test is run.
    // It is too possibly expensive to re-set on-chain directory after each test.
    const removeHotel = await directory.remove(hotel);
    const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
    const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
    assert.equal(removalTxResults.meta.allPassed, true);
    list = await directory.getOrganizations();
    assert.equal(list.length, 2);
    assert.notInclude(list.map(async (a) => a.address), await hotel.address);
  });

  it('should create, add, update and remove a hotel', async () => {
    const jsonClient = libs.getOffChainDataClient('in-memory');
    // hotel description
    const descUri = await jsonClient.upload(JSON.stringify({
      name: 'Premium hotel',
      description: 'Great hotel',
      location: {
        latitude: 'lat',
        longitude: 'long',
      },
    }));
    const dataUri = await jsonClient.upload(JSON.stringify({
      descriptionUri: descUri,
    }));
    // ORG.ID json
    const orgJsonData = JSON.stringify({
      dataFormatVersion: '0.0.0',
      name: 'Premium hotel',
      hotel: {
        name: 'Premium hotel',
        apis: [
          {
            entrypoint: dataUri,
            format: 'windingtree',
          },
          {
            entrypoint: 'http://dummy.restapiexample.com/api/v1/employees',
            format: 'coolapi',
          },
        ],
      },
    });
    const orgJsonUri = await jsonClient.upload(orgJsonData);
    const createHotel = await factory.createOrganization({
      owner: hotelOwner,
      orgJsonUri: orgJsonUri,
      orgJsonHash: web3utils.soliditySha3(orgJsonData),
    });
    const result = await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);
    const hotel = await createHotel.organization;

    assert.isDefined(result);
    assert.isDefined(hotel.address);
    assert.isDefined(result.transactionHash);

    const addHotel = await directory.add(hotel);
    const addingResult = await wallet.signAndSendTransaction(addHotel.transactionData, addHotel.eventCallbacks);
    const addingTxResults = await libs.getTransactionsStatus([addingResult.transactionHash]);
    assert.equal(addingTxResults.meta.allPassed, true);
    const apiPointer = (await hotel.getWindingTreeApi()).hotel[0];
    assert.isDefined(apiPointer);
    assert.equal((await apiPointer.toPlainObject()).contents.descriptionUri.contents.name, 'Premium hotel');

    hotel.orgJsonUri = 'https://example.com';
    const updateHotel = await hotel.updateOnChainData({
      from: hotelOwner,
    });
    for (let i = 0; i < updateHotel.length; i++) {
      const updateResult = await wallet.signAndSendTransaction(updateHotel[i].transactionData, updateHotel[i].eventCallbacks);
      assert.isDefined(updateResult);
      assert.isDefined(updateResult.transactionHash);
    }
    const standaloneHotel = libs.getOrganization(hotel.address);
    assert.equal((await standaloneHotel.orgJsonUri).toLowerCase(), 'https://example.com');

    // verify
    const list = (await directory.getOrganizations());
    assert.equal(list.length, 3);

    // We're removing the hotel to ensure clean slate after this test is run.
    // It is too possibly expensive to re-set on-chain directory after each test.
    const removeHotel = await directory.remove(hotel);
    const removalResult = await wallet.signAndSendTransaction(removeHotel.transactionData, removeHotel.eventCallbacks);
    const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
    assert.equal(removalTxResults.meta.allPassed, true);
  });

  describe('hasAssociatedKey', () => {
    const associatedKeyAddress = '0x04e46F24307E4961157B986a0b653a0D88F9dBd6';

    it('should return true if is associatedKey', async () => {
      const hotel = await libs.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(associatedKeyAddress, {
        from: hotelOwner,
      });
      assert.equal(hasAssociatedKey, true);
    });

    it('should return true if is associatedKey whoever asks', async () => {
      const hotel = await libs.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(associatedKeyAddress, {
        from: '0xB309875d8b24D522Ea0Ac57903c8A0b0C93C414A',
      });
      assert.equal(hasAssociatedKey, true);
    });

    it('should return false if is not associatedKey', async () => {
      const hotel = await libs.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(hotelOwner, {
        from: hotelOwner,
      });
      assert.equal(hasAssociatedKey, false);
    });

    it('should return false if is not associatedKey whoever asks', async () => {
      const hotel = await libs.getOrganization(hotelAddress);
      const hasAssociatedKey = await hotel.hasAssociatedKey(hotelOwner, {
        from: '0xB309875d8b24D522Ea0Ac57903c8A0b0C93C414A',
      });
      assert.equal(hasAssociatedKey, false);
    });
  });

  describe('hasAssociatedKey', () => {
  });

  describe('getSegments', () => {
    it('should return a list of segments', async () => {
      const segments = await entrypoint.getSegments();
      assert.equal(segments.length, 2);
      assert.equal(segments[0], 'airlines');
      assert.equal(segments[1], 'hotels');
    });
  });
});
