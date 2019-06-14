import { assert } from 'chai';
import { WtJsLibs } from '../../src/index';
import jsonWallet from '../utils/test-wallet-2';
import testedDataModel from '../utils/data-airline-model-definition';
import OffChainDataClient from '../../src/off-chain-data-client';

describe('WtJsLibs usage - airlines', () => {
  let libs, wallet, directory, emptyDirectory;
  const airlineOwner = '0x04e46F24307E4961157B986a0b653a0D88F9dBd6';
  const airlineAddress = '0x820410b0E5c06147f1a894247C46Ea936D8A4Eb8';

  beforeEach(() => {
    libs = WtJsLibs.createInstance(testedDataModel.withDataSource());
    directory = libs.getDirectory('airlines', testedDataModel.directoryAddress);
    wallet = libs.createWallet(jsonWallet);
    emptyDirectory = libs.getDirectory('airlines', testedDataModel.emptyDirectoryAddress);
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
      const createAirline = await directory.createAndAdd({
        owner: airlineOwner,
        orgJsonUri: orgJsonUri,
      });
      const airline = createAirline.airline;
      const result = await wallet.signAndSendTransaction(createAirline.transactionData, createAirline.eventCallbacks);

      assert.isDefined(result);
      assert.isDefined(airline.address);
      assert.isDefined(result.transactionHash);

      // Don't bother with checksummed address format
      assert.equal((await airline.owner), airlineOwner);
      assert.equal((await airline.orgJsonUri).toLowerCase(), orgJsonUri);
      assert.isDefined(await airline.created);
      const dataIndex = await airline.dataIndex;
      const description = (await dataIndex.contents).descriptionUri;
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
      const createAirline = await directory.create({
        owner: airlineOwner,
        orgJsonUri: orgJsonUri,
      });
      const airline = createAirline.airline;
      const result = await wallet.signAndSendTransaction(createAirline.transactionData, createAirline.eventCallbacks);

      assert.isDefined(result);
      assert.isDefined(airline.address);
      assert.isDefined(result.transactionHash);

      const addAirline = await directory.add(airline);
      await wallet.signAndSendTransaction(addAirline.transactionData, addAirline.eventCallbacks);

      // verify
      let list = (await directory.getRecords());
      assert.equal(list.length, 3);

      // We're removing the airline to ensure clean slate after this test is run.
      // It is too possibly expensive to re-set on-chain directory after each test.
      const removeAirline = await directory.remove(airline);
      const removalResult = await wallet.signAndSendTransaction(removeAirline.transactionData, removeAirline.eventCallbacks);
      const removalTxResults = await libs.getTransactionsStatus([removalResult.transactionHash]);
      assert.equal(removalTxResults.meta.allPassed, true);
    });
  });

  describe('remove', () => {
    it('should remove airline', async () => {
      const owner = airlineOwner;
      const createAirline = await directory.createAndAdd({
        orgJsonUri: 'in-memory://some-data-hash',
        owner: owner,
      });
      const origAirline = createAirline.airline;
      await wallet.signAndSendTransaction(createAirline.transactionData, createAirline.eventCallbacks);
      assert.isDefined(origAirline.address);

      // Verify that it has been added
      let list = (await directory.getRecords());
      assert.equal(list.length, 3);
      assert.include(await Promise.all(list.map(async (a) => a.address)), origAirline.address);
      const airline = await directory.getRecord(origAirline.address);
      // Remove
      const removeAirline = await directory.remove(airline);
      const removalResult = await wallet.signAndSendTransaction(removeAirline.transactionData, removeAirline.eventCallbacks);
      assert.isDefined(removalResult);
      // Verify that it has been removed
      list = await directory.getRecords();
      assert.equal(list.length, 2);
      assert.notInclude(list.map(async (a) => a.address), await airline.address);
    });
  });

  describe('getRecord', () => {
    it('should get airline by address', async () => {
      const airline = await directory.getRecord(airlineAddress);
      assert.isNotNull(airline);
      assert.equal(await airline.orgJsonUri, 'in-memory://airline-url-one');
      assert.equal(await airline.address, airlineAddress);
    });

    it('should get airline index by address', async () => {
      const idx = await directory.getRecordIndex(airlineAddress);
      assert.equal(idx, 1);
    });

    it('should get airline by index', async () => {
      const firstAirline = await directory.getRecordByIndex(1);
      assert.isNotNull(firstAirline);
      assert.equal(await firstAirline.orgJsonUri, 'in-memory://airline-url-one');
      assert.equal(await firstAirline.address, airlineAddress);
      const secondAirline = await directory.getRecordByIndex(2);
      assert.isNotNull(secondAirline);
      assert.equal(await secondAirline.orgJsonUri, 'in-memory://airline-url-two');
      assert.equal(await secondAirline.address, '0xa9e131d144EaF885DE074409C668f1e8895fcFdB');
    });
  });

  describe('update', () => {
    it('should update airline', async () => {
      const newUri = 'in-memory://another-url';
      const airline = await directory.getRecord(airlineAddress);
      const oldUri = await airline.orgJsonUri;
      airline.orgJsonUri = newUri;
      // Change the data
      const updateAirlineSet = await directory.update(airline);
      let updateResult;
      for (let updateAirline of updateAirlineSet) {
        updateResult = await wallet.signAndSendTransaction(updateAirline.transactionData, updateAirline.eventCallbacks);
        assert.isDefined(updateResult);
      }
      // Verify
      const airline2 = await directory.getRecord(airlineAddress);
      assert.equal(await airline2.orgJsonUri, newUri);
      // Change it back to keep data in line
      airline.orgJsonUri = oldUri;
      const updateAirlineSet2 = await directory.update(airline);
      for (let updateAirline of updateAirlineSet2) {
        updateResult = await wallet.signAndSendTransaction(updateAirline.transactionData, updateAirline.eventCallbacks);
        assert.isDefined(updateResult);
      }
      // Verify it changed properly
      const airline3 = await directory.getRecord(airlineAddress);
      assert.equal(await airline3.orgJsonUri, oldUri);
    });
  });

  describe('getRecords', () => {
    it('should get all airlines', async () => {
      const airlines = await directory.getRecords();
      assert.equal(airlines.length, 2);
      for (let airline of airlines) {
        assert.isDefined(airline.toPlainObject);
        assert.isDefined((await airline.dataIndex).ref);
        const plainAirline = await airline.toPlainObject();
        assert.equal(plainAirline.address, await airline.address);
        assert.equal(plainAirline.owner, await airline.owner);
        assert.isDefined(plainAirline.orgJsonUri.ref);
        assert.isDefined(plainAirline.orgJsonUri.contents);
      }
    });

    it('should get empty list if no airlines are set', async () => {
      const airlines = await emptyDirectory.getRecords();
      assert.equal(airlines.length, 0);
    });
  });

  describe('owner', () => {
    it('should get owner', async () => {
      const airline = await directory.getRecord(airlineAddress);
      assert.isNotNull(airline);
      assert.equal(await airline.owner, airlineOwner);
    });
  });

  describe('hasDelegate', () => {
    const delegateAddress = '0x380586D71798eefE6BDCa55774A23b9701ce3EC9';

    it('should return true if is delegate', async () => {
      const airline = await directory.getRecord(airlineAddress);
      const hasDelegate = await airline.hasDelegate(delegateAddress, {
        from: airlineOwner,
      });
      assert.equal(hasDelegate, true);
    });

    it('should return true if is delegate whoever asks', async () => {
      const airline = await directory.getRecord(airlineAddress);
      const hasDelegate = await airline.hasDelegate(delegateAddress, {
        from: delegateAddress,
      });
      assert.equal(hasDelegate, true);
    });

    it('should return false if is not delegate', async () => {
      const airline = await directory.getRecord(airlineAddress);
      const hasDelegate = await airline.hasDelegate(airlineOwner, {
        from: airlineOwner,
      });
      assert.equal(hasDelegate, false);
    });

    it('should return false if is not delegate whoever asks', async () => {
      const airline = await directory.getRecord(airlineAddress);
      const hasDelegate = await airline.hasDelegate(airlineOwner, {
        from: delegateAddress,
      });
      assert.equal(hasDelegate, false);
    });
  });
});
