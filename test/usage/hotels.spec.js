import { assert } from 'chai';
import { WtJsLibs } from '../../src/index';
import jsonWallet from '../utils/test-wallet';
import testedDataModel from '../utils/data-hotel-model-definition';
import OffChainDataClient from '../../src/off-chain-data-client';

describe('WtJsLibs usage - hotels', () => {
  let libs, wallet, directory, factory;
  const hotelOwner = '0xD39Ca7d186a37bb6Bf48AE8abFeB4c687dc8F906';
  const hotelAddress = '0xBF18B616aC81830dd0C5D4b771F22FD8144fe769';

  beforeEach(() => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
    directory = libs.getDirectory('hotels', testedDataModel.directoryAddress);
    wallet = libs.createWallet(jsonWallet);
    factory = libs.getFactory(testedDataModel.factoryAddress);
    wallet.unlock('test123');
  });

  afterEach(() => {
    wallet.destroy();
    OffChainDataClient._reset();
  });

  it('create and add, update and remove a hotel', async () => {
    const jsonClient = libs.getOffChainDataClient('in-memory');
    // hotel description
    const descUri = await jsonClient.upload({
      name: 'Premium hotel',
      description: 'Great hotel',
      location: {
        latitude: 'lat',
        longitude: 'long',
      },
    });
    const dataUri = await jsonClient.upload({
      descriptionUri: descUri,
    });
      // ORG.ID json
    const orgJsonUri = await jsonClient.upload({
      'dataFormatVersion': '0.0.0',
      'name': 'Premium hotel',
      'hotel': {
        'name': 'Premium hotel',
        'apis': [
          {
            'entrypoint': dataUri,
            'format': 'windingtree',
          },
          {
            'entrypoint': 'http://dummy.restapiexample.com/api/v1/employees',
            'format': 'coolapi',
          },
        ],
      },
    });
    const createHotel = await factory.createAndAddOrganization({
      owner: hotelOwner,
      orgJsonUri: orgJsonUri,
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
    const descUri = await jsonClient.upload({
      name: 'Premium hotel',
      description: 'Great hotel',
      location: {
        latitude: 'lat',
        longitude: 'long',
      },
    });
    const dataUri = await jsonClient.upload({
      descriptionUri: descUri,
    });
      // ORG.ID json
    const orgJsonUri = await jsonClient.upload({
      'dataFormatVersion': '0.0.0',
      'name': 'Premium hotel',
      'hotel': {
        'name': 'Premium hotel',
        'apis': [
          {
            'entrypoint': dataUri,
            'format': 'windingtree',
          },
          {
            'entrypoint': 'http://dummy.restapiexample.com/api/v1/employees',
            'format': 'coolapi',
          },
        ],
      },
    });
    const createHotel = await factory.createOrganization({
      owner: hotelOwner,
      orgJsonUri: orgJsonUri,
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
