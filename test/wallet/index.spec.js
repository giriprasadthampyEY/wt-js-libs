import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../utils/helpers';
import testedDataModel from '../utils/data-hotel-model-definition';
import jsonWallet from '../utils/test-wallet';
import Web3WTWallet from '../../src/wallet';
import {
  MalformedWalletError,
  WalletStateError,
  WalletPasswordError,
  WalletSigningError,
  TransactionMiningError,
  OutOfGasError,
  InsufficientFundsError,
  TransactionRevertedError,
  TransactionDidNotComeThroughError,
  NoReceiptError,
  InaccessibleEthereumNodeError,
  WalletError,
} from '../../src/wallet/errors';

describe('WTLibs.Wallet', () => {
  let wallet;
  const correctPassword = 'test123';
  beforeEach(async function () {
    wallet = Web3WTWallet.createInstance(jsonWallet);
    wallet.setupWeb3Eth(testedDataModel.withDataSource().onChainDataOptions.provider);
  });

  describe('unlock', () => {
    it('should unlock the wallet', async () => {
      wallet.unlock(correctPassword);
    });

    it('should not unlock on a malformed keystore', async () => {
      try {
        wallet = Web3WTWallet.createInstance({ random: 'object' });
        wallet.setupWeb3Eth(testedDataModel.withDataSource().onChainDataOptions.provider);
        wallet.unlock('random-pwd');
        assert(false);
      } catch (e) {
        assert.match(e.message, /not a valid v3 wallet/i);
        assert.instanceOf(e, MalformedWalletError);
      }
    });

    it('should not unlock a wallet without web3Eth', async () => {
      wallet = Web3WTWallet.createInstance(jsonWallet);
      try {
        wallet.unlock(correctPassword);
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot unlock wallet without web3Eth instance/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should not unlock a wallet with a bad password', async () => {
      try {
        wallet.unlock('random-password');
        assert(false);
      } catch (e) {
        assert.match(e.message, /key derivation failed/i);
        assert.instanceOf(e, WalletPasswordError);
      }
    });

    it('should not unlock a wallet with no password', async () => {
      try {
        wallet.unlock();
        assert(false);
      } catch (e) {
        assert.match(e.message, /no password/i);
        assert.instanceOf(e, WalletPasswordError);
      }
    });

    it('should not unlock a destroyed wallet', async () => {
      wallet.destroy();
      try {
        wallet.unlock(correctPassword);
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot unlock destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should translate unknown error', async () => {
      // we just need coverage
      sinon.stub(wallet.web3Eth.accounts, 'decrypt').throws(new Error('Unknown web3-eth-accounts error'));
      try {
        wallet.unlock(correctPassword);
        assert(false);
      } catch (e) {
        wallet.web3Eth.accounts.decrypt.restore();
        assert.match(e.message, /Unknown error during wallet decryption/i);
        assert.instanceOf(e, WalletError);
      }
    });
  });

  describe('lock', () => {
    it('should lock the wallet', async () => {
      wallet.unlock(correctPassword);
      assert.isDefined(wallet._account);
      wallet.lock();
      assert.isUndefined(wallet._account);
    });

    it('should not lock a destroyed wallet', async () => {
      wallet.destroy();
      try {
        wallet.lock();
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot lock destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });
  });

  describe('destroy', () => {
    it('should destroy a wallet', async () => {
      assert.isDefined(wallet._jsonWallet);
      wallet.destroy();
      assert.isUndefined(wallet._jsonWallet);
    });

    it('should lock a wallet before destroying it', async () => {
      wallet.unlock(correctPassword);
      assert.isDefined(wallet._account);
      assert.isDefined(wallet._jsonWallet);
      wallet.destroy();
      assert.isUndefined(wallet._jsonWallet);
      assert.isUndefined(wallet._account);
    });

    it('should not destroy an already destroyed wallet', async () => {
      wallet.destroy();
      try {
        wallet.destroy();
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot destroy destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });
  });

  describe('getAddress', () => {
    let wallet;

    beforeEach(async function () {
      wallet = Web3WTWallet.createInstance(jsonWallet);
      wallet.setupWeb3Eth(testedDataModel.withDataSource().onChainDataOptions.provider);
    });

    it('should throw when no JSON wallet exists', () => {
      wallet._jsonWallet = null;
      try {
        wallet.getAddress();
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot get address/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw when wallet was destroyed', () => {
      wallet.destroy();
      try {
        wallet.getAddress();
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot get address/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw when JSON wallet does not contain address', () => {
      try {
        wallet.getAddress();
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot get address/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should not return the address when in JSON file', () => {
      wallet._jsonWallet.address = 'd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906';
      try {
        wallet.getAddress();
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot get address/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should return the proper address from an unlocked wallet', () => {
      wallet._jsonWallet.address = 'somethingRandom';
      wallet.unlock(correctPassword);
      assert.equal(wallet.getAddress().toLowerCase(), '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906');
    });
  });

  describe('signAndSendTransaction', () => {
    let wallet, sendStub;
    beforeEach(async function () {
      wallet = Web3WTWallet.createInstance(jsonWallet);
      wallet.setupWeb3Eth(testedDataModel.withDataSource().onChainDataOptions.provider);
      sendStub = sinon.stub(wallet.web3Eth, 'sendSignedTransaction').returns(helpers.stubPromiEvent());
    });

    afterEach(() => {
      wallet.web3Eth.sendSignedTransaction.restore();
    });

    it('should throw on a destroyed wallet', async () => {
      wallet.destroy();
      try {
        await wallet.signAndSendTransaction({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot use destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw on a locked wallet', async () => {
      try {
        await wallet.signAndSendTransaction({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot use wallet without unlocking it first/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw on a wallet without web3Eth', async () => {
      const customWallet = Web3WTWallet.createInstance(jsonWallet);
      customWallet.setupWeb3Eth(testedDataModel.withDataSource().onChainDataOptions.provider);
      customWallet.web3Eth = null;
      try {
        await customWallet.signAndSendTransaction({});
        assert(false);
      } catch (e) {
        assert.match(e.message, /cannot use wallet without web3Eth instance/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw on a mismatch between tx originator and wallet owner', async () => {
      wallet.unlock(correctPassword);
      try {
        await wallet.signAndSendTransaction({
          from: '0xSomeRandomAddress',
        });
        assert(false);
      } catch (e) {
        assert.match(e.message, /transaction originator does not match the wallet address/i);
        assert.instanceOf(e, WalletSigningError);
      }
    });

    it('should sign and send a transaction', async () => {
      wallet.unlock(correctPassword);
      sinon.stub(wallet._account, 'signTransaction').resolves({ rawTransaction: 'tx-bytecode' });
      await wallet.signAndSendTransaction({
        from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
        to: 'bbb',
        data: 'data',
        gas: 1234,
      });
      assert.equal(sendStub.callCount, 1);
    });

    it('should resolve with tx hash without callbacks', async () => {
      wallet.unlock(correctPassword);
      sinon.stub(wallet._account, 'signTransaction').resolves({ rawTransaction: 'tx-bytecode' });
      const result = await wallet.signAndSendTransaction({
        from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
        to: 'bbb',
        data: 'data',
        gas: 1234,
      });
      assert.equal(result, 'tx-hash');
    });

    it('should call onReceipt callback and resolve with receipt', async () => {
      wallet.unlock(correctPassword);
      sinon.stub(wallet._account, 'signTransaction').resolves({ rawTransaction: 'tx-bytecode' });
      const receiptCallback = sinon.stub().returns(null);
      const result = await wallet.signAndSendTransaction({
        from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
        to: 'bbb',
        data: 'data',
        gas: 1234,
      }, {
        onReceipt: receiptCallback,
      });
      assert.isDefined(result);
      assert.equal(result.some, 'receipt');
      assert.equal(receiptCallback.callCount, 1);
    });

    it('should call onTransactionHash callback and resolve with tx hash', async () => {
      wallet.unlock(correctPassword);
      sinon.stub(wallet._account, 'signTransaction').resolves({ rawTransaction: 'tx-bytecode' });
      const txHashCallback = sinon.stub().returns(null);
      const result = await wallet.signAndSendTransaction({
        from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
        to: 'bbb',
        data: 'data',
        gas: 1234,
      }, {
        onTransactionHash: txHashCallback,
      });
      assert.equal(result, 'tx-hash');
      assert.equal(txHashCallback.callCount, 1);
    });

    it('should call both callbacks and resolve with receipt', async () => {
      wallet.unlock(correctPassword);
      sinon.stub(wallet._account, 'signTransaction').resolves({ rawTransaction: 'tx-bytecode' });
      const receiptCallback = sinon.stub().returns(null);
      const txHashCallback = sinon.stub().returns(null);
      const result = await wallet.signAndSendTransaction({
        from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
        to: 'bbb',
        data: 'data',
        gas: 1234,
      }, {
        onReceipt: receiptCallback, onTransactionHash: txHashCallback,
      });
      assert.isDefined(result);
      assert.equal(result.some, 'receipt');
      assert.equal(receiptCallback.callCount, 1);
      assert.equal(txHashCallback.callCount, 1);
    });

    const _makeErrorTestCase = (errorSetup, expectedErrorType) => {
      return async () => {
        wallet.unlock(correctPassword);
        sinon.stub(wallet._account, 'signTransaction').resolves({ rawTransaction: 'tx-bytecode' });
        wallet.web3Eth.sendSignedTransaction.restore();
        sinon.stub(wallet.web3Eth, 'sendSignedTransaction').returns(helpers.stubPromiEvent(errorSetup));
        try {
          await wallet.signAndSendTransaction({
            from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
            to: 'bbb',
            data: 'data',
            gas: 1234,
          });
          assert(false);
        } catch (e) {
          assert.instanceOf(e, expectedErrorType);
        }
      };
    };

    it('should reject on random error event', async () => {
      await _makeErrorTestCase({ error: 'random eth error' }, TransactionMiningError)();
      await _makeErrorTestCase({ catch: 'random eth error' }, TransactionMiningError)();
    });

    it('should reject with InsufficientFundsError', async () => {
      await _makeErrorTestCase({ error: 'insufficient funds for gas' }, InsufficientFundsError)();
      await _makeErrorTestCase({ catch: 'insufficient funds for gas' }, InsufficientFundsError)();
    });

    it('should reject with NoReceiptError', async () => {
      await _makeErrorTestCase({ error: 'Failed to check for transaction receipt' }, NoReceiptError)();
      await _makeErrorTestCase({ catch: 'Failed to check for transaction receipt' }, NoReceiptError)();
      await _makeErrorTestCase({ error: 'Receipt missing or blockHash null' }, NoReceiptError)();
      await _makeErrorTestCase({ catch: 'Receipt missing or blockHash null' }, NoReceiptError)();
      await _makeErrorTestCase({ error: 'The transaction receipt didn\'t contain a contract address.' }, NoReceiptError)();
      await _makeErrorTestCase({ catch: 'The transaction receipt didn\'t contain a contract address.' }, NoReceiptError)();
      await _makeErrorTestCase({ error: 'Transaction was not mined within' }, NoReceiptError)();
      await _makeErrorTestCase({ catch: 'Transaction was not mined within' }, NoReceiptError)();
    });

    it('should reject with OutOfGasError', async () => {
      await _makeErrorTestCase({ error: 'The contract code couldn\'t be stored, please check your gas limit.' }, OutOfGasError)();
      await _makeErrorTestCase({ catch: 'The contract code couldn\'t be stored, please check your gas limit.' }, OutOfGasError)();
      await _makeErrorTestCase({ error: 'Transaction ran out of gas. Please provide more gas' }, OutOfGasError)();
      await _makeErrorTestCase({ catch: 'Transaction ran out of gas. Please provide more gas' }, OutOfGasError)();
    });

    it('should reject with TransactionRevertedError', async () => {
      await _makeErrorTestCase({ error: 'Transaction has been reverted by the EVM' }, TransactionRevertedError)();
      await _makeErrorTestCase({ catch: 'Transaction has been reverted by the EVM' }, TransactionRevertedError)();
    });

    it('should reject with TransactionDidNotComeThroughError', async () => {
      await _makeErrorTestCase({ error: 'replacement transaction underpriced' }, TransactionDidNotComeThroughError)();
      await _makeErrorTestCase({ catch: 'replacement transaction underpriced' }, TransactionDidNotComeThroughError)();
      await _makeErrorTestCase({ error: 'known transaction: 14b03e6aefa8ef94fcdff05b7adc9eaf4c88ce15c6d33b3326fa9bd6f15829ab' }, TransactionDidNotComeThroughError)();
      await _makeErrorTestCase({ catch: 'known transaction: 14b03e6aefa8ef94fcdff05b7adc9eaf4c88ce15c6d33b3326fa9bd6f15829ab' }, TransactionDidNotComeThroughError)();
    });

    it('should reject with InaccessibleEthereumNodeError', async () => {
      await _makeErrorTestCase({ error: 'Invalid JSON RPC response' }, InaccessibleEthereumNodeError)();
      await _makeErrorTestCase({ catch: 'Invalid JSON RPC response' }, InaccessibleEthereumNodeError)();
    });

    it('should handle an inaccessible node during tx signing', async () => {
      wallet.unlock(correctPassword);
      sinon.stub(wallet._account, 'signTransaction').rejects({ message: 'Invalid JSON RPC response' });
      try {
        await wallet.signAndSendTransaction({
          from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
          to: 'bbb',
          data: 'data',
          gas: 1234,
        });
        assert(false);
      } catch (e) {
        assert.instanceOf(e, TransactionMiningError);
      } finally {
        wallet._account.signTransaction.restore();
      }
    });
  });

  describe('signData', () => {
    let wallet;
    beforeEach(async function () {
      wallet = Web3WTWallet.createInstance(jsonWallet);
      wallet.setupWeb3Eth(testedDataModel.withDataSource().onChainDataOptions.provider);
      wallet.unlock(correctPassword);
    });

    it('should sign the data', async () => {
      let serializedData = JSON.stringify({
        city: 'Islamabad',
        country: 'Pakistan',
        signer: wallet.getAddress(),
      });
      const signature = await wallet.signData(serializedData);
      assert.isDefined(signature);
      assert.equal(signature, '0xbdf4103642a7449ecca41ac4ab7a00cddd0e7cc07b8ea6845e1c78c76f4c20723fb5e533c11cfc5fdae9d6d428a7118f50185f1a7bf8e127b0d4e969d88127f61c');
    });

    it('should throw on a destroyed wallet', async () => {
      wallet.destroy();
      try {
        await wallet.signData('random string');
        assert(false);
      } catch (e) {
        assert.instanceOf(e, WalletStateError);
        assert.match(e, /destroyed wallet/i);
      }
    });

    it('should throw on a locked wallet', async () => {
      wallet.lock();
      try {
        await wallet.signData('random string');
        assert(false);
      } catch (e) {
        assert.instanceOf(e, WalletStateError);
        assert.match(e, /unlocking it first/i);
      }
    });

    it('should throw when signing throws', async () => {
      sinon.stub(wallet._account, 'sign').rejects({ message: 'Invalid JSON RPC response' });
      try {
        await wallet.signData('random string');
        assert(false);
      } catch (e) {
        assert.instanceOf(e, WalletSigningError);
        assert.match(e, /Invalid JSON RPC response/i);
      } finally {
        wallet._account.sign.restore();
      }
      sinon.stub(wallet._account, 'sign').rejects(new Error('Invalid JSON RPC response'));
      try {
        await wallet.signData('random string');
        assert(false);
      } catch (e) {
        assert.instanceOf(e, WalletSigningError);
        assert.match(e, /Invalid JSON RPC response/i);
      } finally {
        wallet._account.sign.restore();
      }
    });
  });
});
