/**
 * Per-request credential isolation using AsyncLocalStorage.
 *
 * In gateway (HTTP) mode, each inbound request carries its own credentials
 * in headers. Instead of mutating process.env (which is shared across all
 * concurrent requests), we store credentials in AsyncLocalStorage so each
 * request handler sees only its own values.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestCredentials {
  apiKey: string;
  subdomain?: string;
}

export const credentialStore = new AsyncLocalStorage<RequestCredentials>();

/**
 * Get credentials from the current request context (AsyncLocalStorage).
 * Returns undefined when called outside an active store.run() scope.
 */
export function getRequestCredentials(): RequestCredentials | undefined {
  return credentialStore.getStore();
}
