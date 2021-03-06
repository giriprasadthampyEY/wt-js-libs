# Winding Tree Javascript Libraries

[![Greenkeeper badge](https://badges.greenkeeper.io/windingtree/wt-js-libs.svg)](https://greenkeeper.io/)

A JS library for interaction with Winding Tree platform. For detailed description of higher-level
concepts, please head over to our [Developer portal](https://developers.windingtree.com).

## Installation

```sh
npm install @windingtree/wt-js-libs
```

```js
const { WtJsLibs } = require('@windingtree/wt-js-libs');
const libs = WtJsLibs.createInstance({
  onChainDataOptions: { ... },
  offChainDataOptions: { ... },
  trustClueOptions: { ... },
});
const entrypoint = libs.getEntrypoint('0x....');
const hotelsDirectory = await entrypoint.getSegmentDirectory('hotels');
```

```html
<script type="text/javascript" src="https://unpkg.com/@windingtree/wt-js-libs"></script>
<script type="text/javascript" src="https://unpkg.com/@windingtree/off-chain-adapter-in-memory"></script>
<script type="text/javascript" src="https://unpkg.com/@windingtree/trust-clue-curated-list"></script>
<script type="text/javascript">
const libs = window.WtJsLibs.createInstance({
  onChainDataOptions: {
    provider: 'http://localhost:8545', // or infura or any other ETH RPC node
  },
  offChainDataOptions: {
    adapters: {
      'in-memory': {
        create: (options) => {
          return new window.InMemoryAdapter(options);
        },
      },
    },
  },
  trustClueOptions: {
    provider: 'http://localhost:8545', // or infura or any other ETH RPC node
    clues: {
      'curated-list': {
        options: {
          address: '0x...',
          provider: 'http://localhost:8545',
        },
        create: async (options) => {
          return new window.TrustClueCuratedList(options);
        },
      },
    }
  },
});
const entrypoint = libs.getEntrypoint('0x....');
const hotelsDirectory = await entrypoint.getSegmentDirectory('hotels');
const factory = await entrypoint.getOrganizationFactory();
</script>
```

## Usage

For more examples, see `test/usage/integration.spec.js` file. The public interface of this library
should always be the same regardless of what kind of implementation is used
under the hood.

```javascript
// Winding Tree hotel index backed by a local Ethereum node. See below for airlines usage.
// You need to deploy the index and the hotel first. See test/utils/migrations
// for inspiration.
import { WtJsLibs } from '@windingtree/wt-js-libs';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';
import { TrustClueCuratedList } from '@windingtree/trust-clue-curated-list';

const libs = WtJsLibs.createInstance({
  onChainDataOptions: {
    provider: 'http://localhost:8545',
  },
  offChainDataOptions: {
    adapters: {
      // This is how you plug-in any off-chain data adapter you want.
      'in-memory': {
        options: {
          // some: options
        },
        create: (options) => {
          return new InMemoryAdapter(options);
        },
      },
    },
  },
  // This is how you configure trust clues
  trustClueOptions: {
    provider: 'http://localhost:8545', // or infura or any other ETH RPC node
    clues: {
      'curated-list': {
        options: {
          address: '0x...',
          provider: 'http://localhost:8545',
        },
        create: async (options) => {
          return new window.TrustClueCuratedList(options);
        },
      },
    }
  },
});


const entrypoint = libs.getEntrypoint('0x....');
const directory = await entrypoint.getSegmentDirectory('hotels');
const hotel = await directory.getOrganization('0x...');

// You can get all the off-chain data at once
// This approach might be a little slow as all off-chain data gets downloaded
const plainHotel = await hotel.toPlainObject();
// You get a synced plain javascript object you can traverse in any way you want
const hotelName2 = plainHotel.orgJson.contents.name;
// If an ORG.ID is using an API that conform to Winding Tree data model, you can wrap
// them into a storage pointer as well
const hotelApis = await hotel.getWindingTreeApi();
const apiContents = (await hotelApis.hotel[0].toPlainObject()).contents;
const hotelDescriptionDocument = await apiContents.descriptionUri.contents;

// OR you can do it like this

// Accessing off-chain data - the entry point url is actually stored on chain
const orgJson = await hotel.orgJson;
const hotelOrgJsonUrl = orgJson.ref;
// This data is fetched from some off-chain storage
const orgJsonContents = await orgJson.contents;


// How about creating a hotel and adding it to a directory?
wallet = libs.createWallet({/*...Your wallet in a JSON format..*/});
wallet.unlock('with-password');
try {
  const factory = entrypoint.getOrganizationFactory();
  const createHotel = await factory.createAndAddOrganization({
    orgJsonUri: 'https://example.com/my-hotel-data.json',
    owner: '0x...',
  }, directory.address);
  const result = await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);
  // After the transaction is confirmed, one of the callbacks
  // will set the object of the hotel.
  const hotel = await createHotel.organization;
  const newHotelAddress = hotel.address;
} finally {
  wallet.lock();
}

// Working with airline data is very similar. Just change the segment and a few method names:
const directory = entrypoint.getSegmentDirectory('airlines');
const airline = await directory.getOrganization('0x...');

try {
  const factory = entrypoint.getOrganizationFactory('0x...');
  const createAirline = await factory.createAndAddOrganization({
    orgJsonUri: 'https://example.com/my-airline-data.json',
    owner: '0x...',
  }, directory.address);
  const result = await wallet.signAndSendTransaction(transactionData, eventCallbacks);
  // After the transaction is confirmed, one of the callbacks
  // will set the object of the airline.
  const airline = await createAirline.organization;
  const newAirlineAddress = airline.address;
} finally {
  wallet.lock();
}
```

If you want, you can create the airline contract first and add it later:
```js
const createHotel = await factory.createOrganization({
  owner: hotelOwner,
  orgJsonUri: orgJsonUri,
});
const result = await wallet.signAndSendTransaction(createHotel.transactionData, createHotel.eventCallbacks);
const hotel = await createHotel.hotel;

// and add later
const addHotel = await directory.add(hotel);
await wallet.signAndSendTransaction(addHotel.transactionData, addHotel.eventCallbacks);
```

## Documentation

The current documentation can be rendered by running `npm run docs`.

### Off-chain data adapters

These are used to access data stored not on the Ethereum blockchain but in
a different storage. The adapters are used to unify access to these resources.

**Existing implementations**

- [In memory](https://github.com/windingtree/off-chain-adapter-in-memory) - Example basic implementation which is not very useful, but should be enough for quick hacking or testing
- [Swarm](https://github.com/windingtree/off-chain-adapter-swarm) - Uses Ethereum Swarm for off-chain storage.
- [HTTPS](https://github.com/windingtree/off-chain-adapter-http) - Retrieves data from arbitrary HTTPS locations.

#### Developing your own off-chain data adapter

For insipiration, you can have a look at [in-memory adapter](https://github.com/windingtree/off-chain-adapter-in-memory),
if you'd like to create it all by yourself, here's what you need.

1. Your package has to implement a [simple interface](https://github.com/windingtree/wt-js-libs/blob/master/docs/reference.md#offchaindataadapterinterface)
that provides ways to store, update and retrieve data.
1. You can also choose how your plugin is instantiated and whether you need any initialization
options. These will be passed whenever an instance is created.
1. Off Chain data adapters are used in two places
    1. `StoragePointer` - The adapter is used to download off-chain data in there
    1. `OffChainDataClient` - It is responsible for proper instantiation of all off-chain data adapters.

The interface is subject to change as we go along and find out what other types
of storages might require - be it a signature verification, data signing and other non-common
utilities. The only actual method used in the wt-js-libs internals is `download` right now.

### Trust clues

Trust clues are used to determine a trust level towards an actor on Winding Tree
platform. Every client can use and interpret any trust clues they want. This library
does not enforce any combination or implementation of trust clues.

**Existing implementations**

- [Curated List](https://github.com/windingtree/trust-clue-curated-list) - Example list of addresses maintained by a smart contract owner
- [LÍF Deposit](https://github.com/windingtree/trust-clue-lif-deposit) - Lif deposit smart contract

#### Developing your own trust clue

1. Your package has to implement [simple interface](https://github.com/windingtree/wt-js-libs/blob/master/docs/reference.md#trustclueinterface)
that provides ways to get and interpret its value for a particular ETH address.
1. You can also choose how your plugin is instantiated and whether you need any initialization
options. These will be passed whenever an instance of a clue is created.
1. Trust clues are used in a single place - the `TrustClueClient`. However, all users
of this library are encouraged to pass their own `interpret` methods that
convert the raw value into a boolean flag based on the client's needs.


## Test

To run unit tests, run `npm test`.

## Update notifications

Ideally, in addition to storing the data on the WT platform, the
WT Notification API should be used to immediately broadcast any data
changes to interested data consumers. For various reasons, the
wt-js-libs library does not implement this functionality. You
should make yourself familiar with the concept and documentation
at [https://github.com/windingtree/wt-notification-api](https://github.com/windingtree/wt-notification-api)
and make sure to publish the notifications when appropriate. If
you do not do this, things will still work but the consumers
might take a significantly longer time to learn about the latest
changes you made.
