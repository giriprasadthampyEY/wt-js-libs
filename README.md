# Winding Tree Javascript Libraries

[![Greenkeeper badge](https://badges.greenkeeper.io/windingtree/wt-js-libs.svg)](https://greenkeeper.io/)

A JS interface to WindingTree's Ethereum smart-contracts for Hotels and Airlines.

## Installation

```sh
npm install @windingtree/wt-js-libs
```

```js
const { WtJsLibs } = require('@windingtree/wt-js-libs');
const libs = WtJsLibs.createInstance({
  onChainDataOptions: { ... },
  offChainDataOptions: { ... },
});
const index = libs.getWTIndex('0x...');
```

```html
<script type="text/javascript" src="https://unpkg.com/@windingtree/wt-js-libs"></script>
<script type="text/javascript" src="https://unpkg.com/@windingtree/off-chain-adapter-in-memory"></script>
<script type="text/javascript">
const libs = window.WtJsLibs.createInstance({
  onChainDataOptions: {
    provider: 'http://localhost:8545', // or infura
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
});
const index = libs.getWTIndex('hotels', '0x...');
</script>
```

## Usage

For more examples, see `test/usage.spec.js` file. The public interface of this library
should always be the same regardless of what kind of implementation is used
under the hood.

```javascript
// Winding Tree hotel index backed by a local Ethereum node. See below for airlines usage.
// You need to deploy the index and the hotel first. See test/utils/migrations
// for inspiration.
import { WtJsLibs } from '@windingtree/wt-js-libs';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';

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
        }
        create: (options) => {
          return new InMemoryAdapter(options);
        },
      },
    },
  },
});


const index = libs.getWTIndex('hotels', '0x...');
const hotel = await index.getHotel('0x...');

// You can get all the off-chain data at once
// This approach might be a little slow as all off-chain data gets downloaded
const plainHotel = await hotel.toPlainObject();
// You get a synced plain javascript object you can traverse in any way you want
const hotelName2 = plainHotel.dataUri.contents.descriptionUri.contents.name;

// OR you can be picky but faster

// Accessing off-chain data - the entry point url is actually stored on chain
const dataIndex = await hotel.dataIndex;
const hotelDataIndexUrl = dataIndex.ref;
// This data is fetched from some off-chain storage
const dataIndexContents = await dataIndex.contents;
const hotelDescriptionDocument = await dataIndexContents.descriptionUri.contents;
// This data is fetched from another off-chain document
const hotelName = hotelDescriptionDocument.name;


// How about creating a hotel?
wallet = libs.createWallet({/*...Your wallet in a JSON format..*/});
wallet.unlock('with-password');
try {
  const { hotel, transactionData, eventCallbacks } = await index.addHotel({
    manager: wallet.getAddress(),
    dataUri: 'https://example.com/my-hotel-data.json',
  });
  const result = await wallet.signAndSendTransaction(transactionData, eventCallbacks);
  // After the transaction is confirmed, one of the callbacks
  // will set the address of the hotel.
  const newHotelAddress = hotel.address;
} finally {
  wallet.lock();
}

// Working with airline data is very similar. Just change the segment and a few method names:
const index = libs.getWTIndex('hotels', '0x...');
const airline = await index.getAirline('0x...');

try {
  const { airline, transactionData, eventCallbacks } = await index.addAirline({
    manager: wallet.getAddress(),
    dataUri: 'https://example.com/my-airline-data.json',
  });
  const result = await wallet.signAndSendTransaction(transactionData, eventCallbacks);
  // After the transaction is confirmed, one of the callbacks
  // will set the address of the airline.
  const newAirlineAddress = airline.address;
} finally {
  wallet.lock();
}
```

## Documentation

The current documentation can be rendered by running `npm run docs`

### Off-chain data adapters

**Existing implementations**

- [In memory](https://github.com/windingtree/off-chain-adapter-in-memory) - Example basic implementation which is not very useful, but should be enough for quick hacking or testing
- [Swarm](https://github.com/windingtree/off-chain-adapter-swarm) - Uses Ethereum Swarm for off-chain storage.
- [HTTPS](https://github.com/windingtree/off-chain-adapter-http) - Retrieves data from arbitrary HTTPS locations.

#### Developing your own off-chain data adapter

For insipiration, you can have a look at [in-memory adapter](https://github.com/windingtree/off-chain-adapter-in-memory),
if you'd like to create it all by yourself, here's what you need.

1. Your package has to implement a [simple interface](https://github.com/windingtree/wt-js-libs/blob/proposal/next/docs/reference.md#offchaindataadapterinterface)
that provides ways to store, update and retrieve data.
1. You can also choose how your plugin is instantiated and whether you need any initialization
options. These will be passed whenever an instance is created.
1. Off Chain data adapters are used in two places
    1. `StoragePointer` - The adapter is used to download off-chain data in there
    1. `OffChainDataClient` - It is responsible for proper instantiation of all off-chain data adapters.

The interface is subject to change as we go along and find out what other types
of storages might require - be it a signature verification, data signing and other non-common
utilities. The only actual method used in the wt-js-libs internals is `download` right now.

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
