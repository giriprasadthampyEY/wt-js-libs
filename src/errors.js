/**
 * Generic WT Libs error.
 */
export class WTLibsError extends Error {
  constructor (message, originalError) {
    super(message);
    this.name = this.constructor.name;
    this.originalError = originalError;
    Error.captureStackTrace(this, this.constructor);
  }
}
