import { WTLibsError } from '../errors';

/**
 * Generic error related to a trust clue.
 */
export class TrustClueError extends WTLibsError {}

/**
 * An error occurred during a configuration of trust clues.
 */
export class TrustClueConfigurationError extends TrustClueError {}

/**
 * An error occurred during an attempt to use trust clues.
 */
export class TrustClueRuntimeError extends TrustClueError {}
