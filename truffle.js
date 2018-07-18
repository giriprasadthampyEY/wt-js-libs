require('babel-register');
require('babel-polyfill');

module.exports = {
  contracts_directory: './test/utils/contracts',
  migrations_directory: './test/utils/migrations',
  networks: {
    development: {
      host: 'localhost',
      port: 8545,
      network_id: '77'
    }
  },
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  }
};
