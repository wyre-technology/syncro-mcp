/**
 * Lazy-loaded Syncro client
 *
 * This module provides lazy initialization of the Syncro client
 * to avoid loading the entire library upfront.
 */

import type { SyncroClient } from "@asachs01/node-syncro";

export interface SyncroCredentials {
  apiKey: string;
  subdomain?: string;
}

let _client: SyncroClient | null = null;
let _credentials: SyncroCredentials | null = null;

/**
 * Get credentials from environment variables
 */
export function getCredentials(): SyncroCredentials | null {
  const apiKey = process.env.SYNCRO_API_KEY;
  const subdomain = process.env.SYNCRO_SUBDOMAIN;

  if (!apiKey) {
    return null;
  }

  return { apiKey, subdomain };
}

/**
 * Get or create the Syncro client (lazy initialization)
 */
export async function getClient(): Promise<SyncroClient> {
  const creds = getCredentials();

  if (!creds) {
    throw new Error(
      "No API credentials provided. Please configure SYNCRO_API_KEY environment variable."
    );
  }

  // If credentials changed, invalidate the cached client
  if (
    _client &&
    _credentials &&
    (creds.apiKey !== _credentials.apiKey ||
      creds.subdomain !== _credentials.subdomain)
  ) {
    _client = null;
  }

  if (!_client) {
    // Lazy import the library
    const { SyncroClient } = await import("@asachs01/node-syncro");
    _client = new SyncroClient({
      apiKey: creds.apiKey,
      subdomain: creds.subdomain,
    });
    _credentials = creds;
  }

  return _client;
}

/**
 * Clear the cached client (useful for testing)
 */
export function clearClient(): void {
  _client = null;
  _credentials = null;
}
