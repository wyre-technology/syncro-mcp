/**
 * Lazy-loaded Syncro client
 *
 * This module provides lazy initialization of the Syncro client
 * to avoid loading the entire library upfront.
 */

import type { SyncroClient } from "@wyre-technology/node-syncro";
import { getRequestCredentials } from "./credential-store.js";
import { cleanCredential } from "./clean-credential.js";

export interface SyncroCredentials {
  apiKey: string;
  subdomain?: string;
}

let _client: SyncroClient | null = null;
let _credentials: SyncroCredentials | null = null;

/**
 * Get credentials from the per-request store (gateway mode) or
 * environment variables (stdio / env mode).
 *
 * This is the single chokepoint feeding the Syncro SDK, so every value is run
 * through {@link cleanCredential} here. That strips unresolved MCPB/DXT
 * `"${user_config.X}"` placeholders (issue #73) regardless of whether they
 * arrived via env vars, HTTP headers, or Worker secrets.
 */
export function getCredentials(): SyncroCredentials | null {
  // Per-request credentials take priority (gateway HTTP mode); otherwise fall
  // back to environment variables (stdio / env mode).
  const reqCreds = getRequestCredentials();
  const apiKey = cleanCredential(
    reqCreds ? reqCreds.apiKey : process.env.SYNCRO_API_KEY
  );
  const subdomain = cleanCredential(
    reqCreds ? reqCreds.subdomain : process.env.SYNCRO_SUBDOMAIN
  );

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

  // Syncro cannot build a request host without a subdomain. Fail with a clear
  // message here rather than letting an absent (or unresolved "${user_config.X}"
  // placeholder) subdomain reach the SDK, which would otherwise produce a
  // malformed host like "https://${user_config.syncro_subdomain}.syncromsp.com"
  // that DNS-fails on every request. See issue #73.
  if (!creds.subdomain) {
    throw new Error(
      "SYNCRO_SUBDOMAIN is required. Please configure the SYNCRO_SUBDOMAIN " +
        "environment variable with your Syncro subdomain " +
        '(e.g. "acme" for acme.syncromsp.com).'
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
    const { SyncroClient } = await import("@wyre-technology/node-syncro");
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
