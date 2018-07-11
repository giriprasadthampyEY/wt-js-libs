export class WTLibsError extends Error {
  constructor (message) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SmartContractError extends WTLibsError {}

export class WalletError extends WTLibsError {}

export class EthereumNetworkError extends WTLibsError {}

export class DataError extends WTLibsError {}
