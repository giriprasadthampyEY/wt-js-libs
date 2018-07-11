// @flow
import Web3 from 'web3';
import type { WalletInterface, KeystoreV3Interface, TransactionDataInterface, TransactionCallbacksInterface, TxReceiptInterface } from './interfaces';
import { WalletError } from './errors';

/**
 * Web3 based wallet implementation
 */
class Wallet implements WalletInterface {
  _destroyedFlag: boolean;
  _jsonWallet: ?KeystoreV3Interface;
  _account: ?Object;
  web3: Web3;

  /**
   * Creates an initialized instance
   */
  static createInstance (keystoreJsonV3: KeystoreV3Interface): Wallet {
    return new Wallet(keystoreJsonV3);
  }

  constructor (keystoreJsonV3: KeystoreV3Interface) {
    this._jsonWallet = keystoreJsonV3;
    this._destroyedFlag = false;
  }

  /**
   * Sets up an initialized Web3 instance for later use
   */
  setWeb3 (web3: Web3) {
    this.web3 = web3;
  }

  /**
   * It is not possible to do any operations on a destroyed
   * wallet. Wallet is destroyed by calling the `destroy()` method.
   */
  isDestroyed (): boolean {
    return this._destroyedFlag;
  }

  /**
   * Returns the address passed in `keystoreJsonV3`
   * in a checksummed format, e.g. prefixed with 0x
   * and case-sensitive.
   *
   * @throws {WalletError} When wallet was destroyed.
   * @throws {WalletError} When there's no keystore
   */
  getAddress (): string {
    if (this.isDestroyed()) {
      throw new WalletError('Cannot get address of a destroyed wallet.');
    }
    if (!this._jsonWallet || !this._jsonWallet.address) {
      throw new WalletError('Cannot get address from a non existing keystore.');
    }
    return this.web3.utils.toChecksumAddress(this._jsonWallet.address);
  }

  /**
   * Unlocks/decrypts the JSON wallet keystore. <strong>From now on
   * there is a readable privateKey stored in memory!</strong>
   *
   * @throws {WalletError} When wallet was destroyed.
   * @throws {WalletError} When there is no web3 instance configured.
   */
  unlock (password: string) {
    if (this.isDestroyed()) {
      throw new WalletError('Cannot unlock destroyed wallet.');
    }
    if (!this.web3) {
      throw new WalletError('Cannot unlock wallet without web3 instance.');
    }
    try {
      this.__account = this.web3.eth.accounts.decrypt(this._jsonWallet, password);
    } catch (e) {
      throw new WalletError(e);
    }
  }
  
  /**
   * Takes transaction data, signs them with an unlocked private key and sends them to
   * the network. Resolves either immediately after receiving a `transactionHash` (with hash) or after
   * a `receipt` event (with raw receipt object). This depends on passed eventCallbacks.
   * When onReceipt callback is present, Promise is resolved after `receipt` event
   *
   * @throws {WalletError} When wallet was destroyed.
   * @throws {WalletError} When there is no web3 instance configured.
   * @throws {WalletError} When wallet is not unlocked.
   * @throws {WalletError} When transaction.from does not match the wallet account.
   * @param  {TransactionDataInterface} transactionData
   * @param  {TransactionCallbacksInterface} optional callbacks called when events come back from the network
   * @return {Promise<string|TxReceiptInterface>} transaction hash
   */
  async signAndSendTransaction (transactionData: TransactionDataInterface, eventCallbacks: ?TransactionCallbacksInterface): Promise<string | TxReceiptInterface> {
    if (this.isDestroyed()) {
      throw new WalletError('Cannot use destroyed wallet.');
    }
    if (!this.web3) {
      throw new WalletError('Cannot use wallet without web3 instance.');
    }
    if (!this._account) {
      throw new WalletError('Cannot use wallet without unlocking it first.');
    }
    // Ignore checksummed formatting
    if (transactionData.from && transactionData.from.toLowerCase() !== this.getAddress().toLowerCase()) {
      throw new WalletError('Transaction originator does not match the wallet address.');
    }
    const signedTx = await this._account.signTransaction(transactionData);
    return new Promise(async (resolve, reject) => {
      return this.web3.eth.sendSignedTransaction(signedTx.rawTransaction)
        .on('transactionHash', (hash) => {
          if (eventCallbacks && eventCallbacks.onTransactionHash) {
            eventCallbacks.onTransactionHash(hash);
          }
          if (!eventCallbacks || !eventCallbacks.onReceipt) {
            resolve(hash);
          }
        }).on('receipt', (receipt) => {
          if (eventCallbacks && eventCallbacks.onReceipt) {
            eventCallbacks.onReceipt(receipt);
          }
          resolve(receipt);
        }).on('error', (err) => {
          reject(new WalletError('Cannot send transaction: ' + err));
        }).catch((err) => {
          reject(new WalletError('Cannot send transaction: ' + err));
        });
    });
  }

  /**
   * Locks the wallet, i. e. deletes the private key from memory.
   * The original JSON keystore remains in the memory and can
   * be unlocked again if necessary.
   *
   * This relies on the JS garbage collector, so please do not reference
   * the internal variables of this class elsewhere.
   *
   * @throws {WalletError} When wallet was destroyed.
   */
  lock () {
    if (this.isDestroyed()) {
      throw new WalletError('Cannot lock destroyed wallet.');
    }
    this._account = null;
    delete this._account;
  }

  /**
   * Destroys the wallet. It first locks it, thus deleting
   * the private key from memory and then removes from
   * memory the JSON file.
   *
   * This relies on the JS garbage collector, so please do not reference
   * the internal variables of this class elsewhere.
   *
   * @throws {WalletError} When wallet was destroyed.
   */
  destroy () {
    if (this.isDestroyed()) {
      throw new WalletError('Cannot destroy destroyed wallet.');
    }
    this.lock();
    this._jsonWallet = null;
    delete this._jsonWallet;
    this._destroyedFlag = true;
  }
}

export default Wallet;
