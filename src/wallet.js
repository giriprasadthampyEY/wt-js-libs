// @flow
import Web3 from 'web3';
import type { WalletInterface, TxReceiptInterface, KeystoreV3Interface, TransactionDataInterface } from './interfaces';

/**
 * Web3 based wallet implementation
 */
class Wallet implements WalletInterface {
  __destroyedFlag: boolean;
  __jsonWallet: ?KeystoreV3Interface;
  __account: ?Object;
  web3: Web3;

  /**
   * Creates an initialized instance
   */
  static createInstance (keystoreJsonV3: KeystoreV3Interface): Wallet {
    return new Wallet(keystoreJsonV3);
  }

  constructor (keystoreJsonV3: KeystoreV3Interface) {
    this.__jsonWallet = keystoreJsonV3;
    this.__destroyedFlag = false;
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
    return this.__destroyedFlag;
  }

  /**
   * Returns the address passed in `keystoreJsonV3`
   * in a checksummed format, e.g. prefixed with 0x
   * and case-sensitive.
   *
   * @throws {Error} When wallet was destroyed.
   * @throws {Error} When there's no keystore
   */
  getAddress (): string {
    if (this.isDestroyed()) {
      throw new Error('Cannot get address of a destroyed wallet.');
    }
    if (!this.__jsonWallet || !this.__jsonWallet.address) {
      throw new Error('Cannot get address from a non existing keystore.');
    }
    return this.web3.utils.toChecksumAddress(this.__jsonWallet.address);
  }

  /**
   * Unlocks/decrypts the JSON wallet keystore. <strong>From now on
   * there is a readable privateKey stored in memory!</strong>
   *
   * @throws {Error} When wallet was destroyed.
   * @throws {Error} When there is no web3 instance configured.
   */
  unlock (password: string) {
    if (this.isDestroyed()) {
      throw new Error('Cannot unlock destroyed wallet.');
    }
    if (!this.web3) {
      throw new Error('Cannot unlock wallet without web3 instance.');
    }
    this.__account = this.web3.eth.accounts.decrypt(this.__jsonWallet, password);
  }
  
  /**
   * Takes transaction data, signs them with an unlocked private key and sends them to
   * the network. Resolves immediately after receiving a `transactionHash` event and optionally
   * may run an `onReceipt` callback after receiving the `receipt` event.
   *
   * @throws {Error} When wallet was destroyed.
   * @throws {Error} When there is no web3 instance configured.
   * @throws {Error} When wallet is not unlocked.
   * @throws {Error} When transaction.from does not match the wallet account.
   * @param  {TransactionDataInterface} transactionData
   * @param  {(receipt: TxReceiptInterface) => void} onReceipt optional callback called when receipt event comes back from the network node
   * @return {Promise<string>} transaction hash
   */
  async signAndSendTransaction (transactionData: TransactionDataInterface, onReceipt: ?(receipt: TxReceiptInterface) => void): Promise<string> {
    if (this.isDestroyed()) {
      throw new Error('Cannot use destroyed wallet.');
    }
    if (!this.web3) {
      throw new Error('Cannot use wallet without web3 instance.');
    }
    if (!this.__account) {
      throw new Error('Cannot use wallet without unlocking it first.');
    }
    // Ignore checksummed formatting
    if (transactionData.from && transactionData.from.toLowerCase() !== this.getAddress().toLowerCase()) {
      throw new Error('Transaction originator does not match the wallet address.');
    }
    const signedTx = await this.__account.signTransaction(transactionData);
    return new Promise(async (resolve, reject) => {
      return this.web3.eth.sendSignedTransaction(signedTx.rawTransaction)
        .on('transactionHash', (hash) => {
          resolve(hash);
        }).on('receipt', (receipt) => {
          if (onReceipt) {
            onReceipt(receipt);
          }
        }).on('error', (err) => {
          reject(new Error('Cannot send transaction: ' + err));
        }).catch((err) => {
          reject(new Error('Cannot send transaction: ' + err));
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
   * @throws {Error} When wallet was destroyed.
   */
  lock () {
    if (this.isDestroyed()) {
      throw new Error('Cannot lock destroyed wallet.');
    }
    this.__account = null;
    delete this.__account;
  }

  /**
   * Destroys the wallet. It first locks it, thus deleting
   * the private key from memory and then removes from
   * memory the JSON file.
   *
   * This relies on the JS garbage collector, so please do not reference
   * the internal variables of this class elsewhere.
   *
   * @throws {Error} When wallet was destroyed.
   */
  destroy () {
    if (this.isDestroyed()) {
      throw new Error('Cannot destroy destroyed wallet.');
    }
    this.lock();
    this.__jsonWallet = null;
    delete this.__jsonWallet;
    this.__destroyedFlag = true;
  }
}

export default Wallet;
