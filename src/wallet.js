// @flow
import Web3 from 'web3';
import type { WalletInterface, KeystoreV3Interface, TransactionDataInterface, TransactionCallbacksInterface, TxReceiptInterface } from './interfaces';
import { WalletError, MalformedWalletError, WalletStateError, WalletPasswordError, WalletSigningError } from './errors';

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
   * @throws {WalletStateError} When wallet was destroyed.
   * @throws {WalletStateError} When there's no keystore
   */
  getAddress (): string {
    if (this.isDestroyed()) {
      throw new WalletStateError('Cannot get address of a destroyed wallet.');
    }
    if (!this._jsonWallet || !this._jsonWallet.address) {
      throw new WalletStateError('Cannot get address from a non existing keystore.');
    }
    return this.web3.utils.toChecksumAddress(this._jsonWallet.address);
  }

  /**
   * Unlocks/decrypts the JSON wallet keystore. <strong>From now on
   * there is a readable privateKey stored in memory!</strong>
   *
   * @throws {WalletStateError} When wallet was destroyed.
   * @throws {WalletStateError} When there is no web3 instance configured.
   * @throws {WalletPasswordError} When wallet cannot be decrypted.
   * @throws {MalformedWalletError} When wallet format is not recognized by web3.
   * @throws {WalletError} When anything else breaks down during decryption. But
   * that should actually never happen unless the web3 implementation is changed.
   */
  unlock (password: string) {
    if (this.isDestroyed()) {
      throw new WalletStateError('Cannot unlock destroyed wallet.');
    }
    if (!this.web3) {
      throw new WalletStateError('Cannot unlock wallet without web3 instance.');
    }
    try {
      this.__account = this.web3.eth.accounts.decrypt(this._jsonWallet, password);
    } catch (e) {
      if (e && e.message) {
        // Tihs heavily relies on web3-eth-accounts implementation
        if (e.message.match(/not a valid v3 wallet/i) || e.message.match(/unsupported/i)) {
          throw new MalformedWalletError(e);
        }
        if (e.message.match(/password/i)) {
          throw new WalletPasswordError(e);
        }
      }
      throw new WalletError('Uknown error during wallet decryption');
    }
  }
  
  /**
   * Takes transaction data, signs them with an unlocked private key and sends them to
   * the network. Resolves either immediately after receiving a `transactionHash` (with hash) or after
   * a `receipt` event (with raw receipt object). This depends on passed eventCallbacks.
   * When onReceipt callback is present, Promise is resolved after `receipt` event
   *
   * @throws {WalletStateError} When wallet was destroyed.
   * @throws {WalletStateError} When there is no web3 instance configured.
   * @throws {WalletStateError} When wallet is not unlocked.
   * @throws {WalletSigningError} When transaction.from does not match the wallet account.
   * @param  {TransactionDataInterface} transactionData
   * @param  {TransactionCallbacksInterface} optional callbacks called when events come back from the network
   * @return {Promise<string|TxReceiptInterface>} transaction hash
   */
  async signAndSendTransaction (transactionData: TransactionDataInterface, eventCallbacks: ?TransactionCallbacksInterface): Promise<string | TxReceiptInterface> {
    if (this.isDestroyed()) {
      throw new WalletStateError('Cannot use destroyed wallet.');
    }
    if (!this.web3) {
      throw new WalletStateError('Cannot use wallet without web3 instance.');
    }
    if (!this._account) {
      throw new WalletStateError('Cannot use wallet without unlocking it first.');
    }
    // Ignore checksummed formatting
    if (transactionData.from && transactionData.from.toLowerCase() !== this.getAddress().toLowerCase()) {
      throw new WalletSigningError('Transaction originator does not match the wallet address.');
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
   * @throws {WalletStateError} When wallet was destroyed.
   */
  lock () {
    if (this.isDestroyed()) {
      throw new WalletStateError('Cannot lock destroyed wallet.');
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
   * @throws {WalletStateError} When wallet was destroyed.
   */
  destroy () {
    if (this.isDestroyed()) {
      throw new WalletStateError('Cannot destroy destroyed wallet.');
    }
    this.lock();
    this._jsonWallet = null;
    delete this._jsonWallet;
    this._destroyedFlag = true;
  }
}

export default Wallet;
