import { assert } from 'chai';
import { WtJsLibs } from '../../src/index';
import jsonWallet from '../utils/test-wallet-2';
import testedDataModel from '../utils/data-airline-model-definition';
import OffChainDataClient from '../../src/off-chain-data-client';

describe('WtJsLibs usage - airlines', () => {
  let libs, wallet, directory, emptyDirectory, factory;
  const airlineOwner = '0x04e46F24307E4961157B986a0b653a0D88F9dBd6';
  const airlineAddress = '0x0C4c734F0Ecb92270D1ebE7b04aEC4440EB05CAa';

  beforeEach(() => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
    directory = libs.getDirectory('airlines', testedDataModel.directoryAddress);
    wallet = libs.createWallet(jsonWallet);
    emptyDirectory = libs.getDirectory('airlines', testedDataModel.emptyDirectoryAddress);
    factory = libs.getFactory(testedDataModel.factoryAddress);
    wallet.unlock('test123');
  });

  afterEach(() => {
    wallet.destroy();
    OffChainDataClient._reset();
  });

  describe('segment', () => {
    it('should get correct segment', async () => {
      const segment = await directory.getSegment({
        from: airlineOwner,
      });
      assert.equal(segment, 'airlines');
    });
  });

  describe('create and add', () => {
    it('should create and add airline', async () => {
      const jsonClient = libs.getOffChainDataClient('in-memory');
      // airline description
      const descUrl = await jsonClient.upload({
        name: 'Premium airline',
        description: 'Great airline',
        location: {
          latitude: 'lat',
          longitude: 'long',
        },
      });
      // ORG.ID json
      const orgJsonUri = await jsonClient.upload({
        descriptionUri: descUrl,
      });
      const createAirline = await factory.createOrganization({ // TODO replace with createAndAdd
        owner: airlineOwner,
        orgJsonUri: orgJsonUri,
      });
      const result = await wallet.signAndSendTransaction(createAirline.transactionData, createAirline.eventCallbacks);
      const airline = await createAirline.organization;

      assert.isDefined(result);
      assert.isDefined(airline.address);
      assert.isDefined(result.transactionHash);

      // Don't bother with checksummed address format
      assert.equal((await airline.owner), airlineOwner);
      assert.equal((await airline.orgJsonUri).toLowerCase(), orgJsonUri);
      const orgJson = await airline.orgJson; // TODO this won't work at first
      const description = (await orgJson.contents).descriptionUri;
      assert.equal((await description.contents).name, 'Premium airline');

      // We're removing the airline to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain directory after each test.
      const removeAirline = await directory.remove(airline);
      const removalResult = await wallet.signAndSendTransaction(removeAirline.transactionData, removeAirline.eventCallbacks);
      const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      assert.equal(removalTxResults.meta.allPassed, true);
    });

    it('should create then add airline', async () => {
      const jsonClient = libs.getOffChainDataClient('in-memory');
      const descUrl = await jsonClient.upload({
        name: 'Premium airline',
        description: 'Great airline',
        location: {
          latitude: 'lat',
          longitude: 'long',
        },
      });
      const orgJsonUri = await jsonClient.upload({
        descriptionUri: descUrl,
      });
      const createAirline = await factory.createOrganization({
        owner: airlineOwner,
        orgJsonUri: orgJsonUri,
      });
      const result = await wallet.signAndSendTransaction(createAirline.transactionData, createAirline.eventCallbacks);
      const airline = await createAirline.organization;

      assert.isDefined(result);
      assert.isDefined(airline.address);
      assert.isDefined(result.transactionHash);

      const addAirline = await directory.add(airline);
      const addingResult = await wallet.signAndSendTransaction(addAirline.transactionData, addAirline.eventCallbacks);
      const addingTxResults = await libs.getTransactionsStatus([addingResult.transactionHash]);
      assert.equal(addingTxResults.meta.allPassed, true);

      // verify
      let list = (await directory.getOrganizations());
      assert.equal(list.length, 3);

      // We're removing the airline to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain directory after each test.
      const removeAirline = await directory.remove(airline);
      const removalResult = await wallet.signAndSendTransaction(removeAirline.transactionData, removeAirline.eventCallbacks);
      const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      assert.equal(removalTxResults.meta.allPassed, true);
    });
  });

  xdescribe('remove', () => {
    it('should remove airline', async () => {
      const owner = airlineOwner;
      const createAirline = await factory.createAndAdd({ // TODO
        orgJsonUri: 'in-memory://some-data-hash',
        owner: owner,
      });
      const origAirline = createAirline.airline;
      await wallet.signAndSendTransaction(createAirline.transactionData, createAirline.eventCallbacks);
      assert.isDefined(origAirline.address);

      // Verify that it has been added
      let list = (await directory.getOrganizations());
      assert.equal(list.length, 3);
      assert.include(await Promise.all(list.map(async (a) => a.address)), origAirline.address);
      const airline = await directory.getOrganization(origAirline.address);
      // Remove
      const removeAirline = await directory.remove(airline);
      const removalResult = await wallet.signAndSendTransaction(removeAirline.transactionData, removeAirline.eventCallbacks);
      assert.isDefined(removalResult);
      // Verify that it has been removed
      list = await directory.getOrganizations();
      assert.equal(list.length, 2);
      assert.notInclude(list.map(async (a) => a.address), await airline.address);
    });
  });

  describe('getOrganization', () => {
    it('should get airline by address', async () => {
      const airline = await directory.getOrganization(airlineAddress);
      assert.isNotNull(airline);
      assert.equal(await airline.orgJsonUri, 'in-memory://airline-one');
      assert.equal(await airline.address, airlineAddress);
    });

    it('should get airline index by address', async () => {
      const idx = await directory.getOrganizationIndex(airlineAddress);
      assert.equal(idx, 1);
    });

    it('should get airline by index', async () => {
      const firstAirline = await directory.getOrganizationByIndex(1);
      assert.isNotNull(firstAirline);
      assert.equal(await firstAirline.orgJsonUri, 'in-memory://airline-one');
      assert.equal(await firstAirline.address, airlineAddress);
      const secondAirline = await directory.getOrganizationByIndex(2);
      assert.isNotNull(secondAirline);
      assert.equal(await secondAirline.orgJsonUri, 'in-memory://airline-two');
      assert.equal(await secondAirline.address, '0x714D6eB9B497b383afbB8204cfD948061920DA43');
    });
  });

  describe('getOrganizations', () => {
    it('should get all airlines', async () => {
      const airlines = await directory.getOrganizations();
      assert.equal(airlines.length, 2);
      for (let airline of airlines) {
        assert.isDefined(airline.toPlainObject);
        assert.isDefined((await airline.orgJson).ref);
        const plainAirline = await airline.toPlainObject();
        assert.equal(plainAirline.address, await airline.address);
        assert.equal(plainAirline.owner, await airline.owner);
        assert.isDefined(plainAirline.orgJsonUri.ref);
        assert.isDefined(plainAirline.orgJsonUri.contents);
      }
    });

    it('should get empty list if no airlines are set', async () => {
      const airlines = await emptyDirectory.getOrganizations();
      assert.equal(airlines.length, 0);
    });
  });

  describe('owner', () => {
    it('should get owner', async () => {
      const airline = await directory.getOrganization(airlineAddress);
      assert.isNotNull(airline);
      assert.equal(await airline.owner, airlineOwner);
    });
  });

  describe('hasAssociatedKey', () => {
    const associatedKeyAddress = '0x380586d71798eefe6bdca55774a23b9701ce3ec9';

    it('should return true if is associatedKey', async () => {
      const airline = await directory.getOrganization(airlineAddress);
      const hasAssociatedKey = await airline.hasAssociatedKey(associatedKeyAddress, {
        from: airlineOwner,
      });
      assert.equal(hasAssociatedKey, true);
    });

    it('should return true if is associatedKey whoever asks', async () => {
      const airline = await directory.getOrganization(airlineAddress);
      const hasAssociatedKey = await airline.hasAssociatedKey(associatedKeyAddress, {
        from: '0xB309875d8b24D522Ea0Ac57903c8A0b0C93C414A',
      });
      assert.equal(hasAssociatedKey, true);
    });

    it('should return false if is not associatedKey', async () => {
      const airline = await directory.getOrganization(airlineAddress);
      const hasAssociatedKey = await airline.hasAssociatedKey(airlineOwner, {
        from: airlineOwner,
      });
      assert.equal(hasAssociatedKey, false);
    });

    it('should return false if is not associatedKey whoever asks', async () => {
      const airline = await directory.getOrganization(airlineAddress);
      const hasAssociatedKey = await airline.hasAssociatedKey(airlineOwner, {
        from: '0xB309875d8b24D522Ea0Ac57903c8A0b0C93C414A',
      });
      assert.equal(hasAssociatedKey, false);
    });
  });
});
