# Winding Tree Javascript Libraries for Hotels

A JS interface to WindingTree's Ethereum smart-contracts for Hotels.

## Installation

```sh
npm install @windingtree/wt-js-libs
# or
git clone https://github.com/windingtree/wt-js-libs
nvm install
npm install
```

## Usage

For more examples, see `test/usage.spec.js` file. The public interface of this library
should always be the same regardless of what kind of implementation is used
under the hood.

```javascript
// Winding Tree backed by a local Ethereum node.
// You need to deploy the index and the hotel first. See test/utils/migrations
// for inspiration.
import WTLibs from '@windingtree/wt-js-libs';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';

const libs = WTLibs.createInstance({
  dataModelOptions: {
    provider: 'http://localhost:8545',
  },
  offChainDataOptions: {
    adapters: {
      // This is how you plug-in any off-chain data adapter you want.
      json: {
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
const index = await libs.getWTIndex('0x...');
const hotel = await index.getHotel('0x...');
// Accessing off-chain data - url is actually stored on chain
const hotelDescriptionUrl = await (await hotel.dataIndex).ref;
// This data is fetched from some off-chain storage
const hotelDescription = await (await hotel.dataIndex).contents.description;
const hotelName = await hotelDescription.contents.name;
```

## Documentation

The current documentation can be rendered by running `npm run docs`

### Off-chain data adapters

**Existing implementations**

- [In memory](https://github.com/windingtree/off-chain-adapter-in-memory) - Example basic implementation which is not very useful, but should be enough for quick hacking or testing

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
