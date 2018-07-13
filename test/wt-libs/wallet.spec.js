import { assert } from 'chai';
import sinon from 'sinon';
import helpers from '../utils/helpers';
import testedDataModel from '../utils/data-model-definition';
import jsonWallet from '../utils/test-wallet';
import DataModel from '../../src/data-model/';
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
  NoReceiptError,
  InaccessibleEthereumNodeError,
} from '../../src/errors';

describe('WTLibs.Wallet', () => {
  let dataModel;
  const correctPassword = 'test123';
  beforeEach(async function () {
    dataModel = DataModel.createInstance(testedDataModel.withDataSource().dataModelOptions);
  });

  describe('unlock', () => {
    it('should unlock the wallet', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      wallet.unlock(correctPassword);
    });

    it('should not unlock on a malformed keystore', async () => {
      try {
        const wallet = await dataModel.createWallet({ random: 'object' });
        wallet.unlock('random-pwd');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /not a valid v3 wallet/i);
        assert.instanceOf(e, MalformedWalletError);
      }
    });

    it('should not unlock a wallet without web3', async () => {
      const wallet = Web3WTWallet.createInstance(jsonWallet);
      try {
        wallet.unlock(correctPassword);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot unlock wallet without web3 instance/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should not unlock a wallet with a bad password', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      try {
        wallet.unlock('random-password');
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /key derivation failed/i);
        assert.instanceOf(e, WalletPasswordError);
      }
    });

    it('should not unlock a wallet with no password', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      try {
        wallet.unlock();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /no password/i);
        assert.instanceOf(e, WalletPasswordError);
      }
    });

    it('should not unlock a destroyed wallet', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      wallet.destroy();
      try {
        wallet.unlock(correctPassword);
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot unlock destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });
  });

  describe('lock', () => {
    it('should lock the wallet', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      wallet.unlock(correctPassword);
      assert.isDefined(wallet._account);
      wallet.lock();
      assert.isUndefined(wallet._account);
    });

    it('should not lock a destroyed wallet', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      wallet.destroy();
      try {
        wallet.lock();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot lock destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });
  });

  describe('destroy', () => {
    it('should destroy a wallet', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      assert.isDefined(wallet._jsonWallet);
      wallet.destroy();
      assert.isUndefined(wallet._jsonWallet);
    });

    it('should lock a wallet before destroying it', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      wallet.unlock(correctPassword);
      assert.isDefined(wallet._account);
      assert.isDefined(wallet._jsonWallet);
      wallet.destroy();
      assert.isUndefined(wallet._jsonWallet);
      assert.isUndefined(wallet._account);
    });

    it('should not destroy an already destroyed wallet', async () => {
      const wallet = await dataModel.createWallet(jsonWallet);
      wallet.destroy();
      try {
        wallet.destroy();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot destroy destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });
  });

  describe('getAddress', () => {
    let wallet;

    beforeEach(async function () {
      wallet = await dataModel.createWallet(jsonWallet);
    });

    it('should return the address', () => {
      assert.equal(wallet.getAddress().toLowerCase(), '0x' + jsonWallet.address);
    });

    it('should throw when no JSON wallet exists', () => {
      wallet._jsonWallet = null;
      try {
        wallet.getAddress();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot get address/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw when wallet was destroyed', () => {
      wallet.destroy();
      try {
        wallet.getAddress();
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot get address/i);
        assert.instanceOf(e, WalletStateError);
      }
    });
  });

  describe('signAndSendTransaction', () => {
    let wallet, sendStub;
    beforeEach(async function () {
      wallet = await dataModel.createWallet(jsonWallet);
      sendStub = sinon.stub(wallet.web3.eth, 'sendSignedTransaction').returns(helpers.stubPromiEvent());
    });

    afterEach(() => {
      wallet.web3.eth.sendSignedTransaction.restore();
    });

    it('should throw on a destroyed wallet', async () => {
      wallet.destroy();
      try {
        await wallet.signAndSendTransaction({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot use destroyed wallet/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw on a locked wallet', async () => {
      try {
        await wallet.signAndSendTransaction({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot use wallet without unlocking it first/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw on a wallet without web3', async () => {
      const customWallet = await dataModel.createWallet(jsonWallet);
      customWallet.web3 = null;
      try {
        await customWallet.signAndSendTransaction({});
        throw new Error('should not have been called');
      } catch (e) {
        assert.match(e.message, /cannot use wallet without web3 instance/i);
        assert.instanceOf(e, WalletStateError);
      }
    });

    it('should throw on a mismatch between tx originator and wallet owner', async () => {
      wallet.unlock(correctPassword);
      try {
        await wallet.signAndSendTransaction({
          from: '0xSomeRandomAddress',
        });
        throw new Error('should not have been called');
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
        wallet.web3.eth.sendSignedTransaction.restore();
        sinon.stub(wallet.web3.eth, 'sendSignedTransaction').returns(helpers.stubPromiEvent(errorSetup));
        try {
          await wallet.signAndSendTransaction({
            from: '0xd39ca7d186a37bb6bf48ae8abfeb4c687dc8f906',
            to: 'bbb',
            data: 'data',
            gas: 1234,
          });
          throw new Error('should not have been called');
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
        throw new Error('should not have been called');
      } catch (e) {
        assert.instanceOf(e, TransactionMiningError);
      } finally {
        wallet._account.signTransaction.restore();
      }
    });
  });
});
