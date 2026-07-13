/**
 * Tests for the lazy-loaded Syncro client
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCredentials, getClient, clearClient } from "../../src/utils/client.js";

// Mock the Syncro client module
vi.mock("@wyre-technology/node-syncro", () => ({
  SyncroClient: vi.fn().mockImplementation(function (config) { return ({
    config,
    customers: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
    tickets: { list: vi.fn(), get: vi.fn(), create: vi.fn(), update: vi.fn(), addComment: vi.fn() },
    assets: { list: vi.fn(), get: vi.fn() },
    contacts: { list: vi.fn(), get: vi.fn(), create: vi.fn() },
    invoices: { list: vi.fn(), get: vi.fn(), create: vi.fn(), email: vi.fn() },
  }) }),
}));

describe("client.ts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    // Clear the cached client between tests
    clearClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getCredentials", () => {
    it("should return null when SYNCRO_API_KEY is not set", () => {
      delete process.env.SYNCRO_API_KEY;
      delete process.env.SYNCRO_SUBDOMAIN;

      const creds = getCredentials();
      expect(creds).toBeNull();
    });

    it("should return credentials with only apiKey when SYNCRO_SUBDOMAIN is not set", () => {
      process.env.SYNCRO_API_KEY = "test-api-key";
      delete process.env.SYNCRO_SUBDOMAIN;

      const creds = getCredentials();
      expect(creds).toEqual({
        apiKey: "test-api-key",
        subdomain: undefined,
      });
    });

    it("should return credentials with both apiKey and subdomain", () => {
      process.env.SYNCRO_API_KEY = "test-api-key";
      process.env.SYNCRO_SUBDOMAIN = "mycompany";

      const creds = getCredentials();
      expect(creds).toEqual({
        apiKey: "test-api-key",
        subdomain: "mycompany",
      });
    });

    // Regression: issue #73 — a blank OPTIONAL user_config field in an MCPB/DXT
    // bundle injects the literal "${user_config.syncro_subdomain}" string.
    it("should treat an unresolved subdomain placeholder as absent", () => {
      process.env.SYNCRO_API_KEY = "test-api-key";
      process.env.SYNCRO_SUBDOMAIN = "${user_config.syncro_subdomain}";

      const creds = getCredentials();
      expect(creds).toEqual({
        apiKey: "test-api-key",
        subdomain: undefined,
      });
    });

    it("should treat an unresolved api key placeholder as absent (null)", () => {
      process.env.SYNCRO_API_KEY = "${user_config.syncro_api_key}";
      process.env.SYNCRO_SUBDOMAIN = "mycompany";

      expect(getCredentials()).toBeNull();
    });
  });

  describe("getClient", () => {
    it("should throw error when no credentials are configured", async () => {
      delete process.env.SYNCRO_API_KEY;

      await expect(getClient()).rejects.toThrow(
        "No API credentials provided. Please configure SYNCRO_API_KEY environment variable."
      );
    });

    it("should create client with correct configuration", async () => {
      process.env.SYNCRO_API_KEY = "test-api-key";
      process.env.SYNCRO_SUBDOMAIN = "mycompany";

      const client = await getClient();

      expect(client).toBeDefined();
      expect(client.config).toEqual({
        apiKey: "test-api-key",
        subdomain: "mycompany",
      });
    });

    it("should return cached client on subsequent calls", async () => {
      process.env.SYNCRO_API_KEY = "test-api-key";
      process.env.SYNCRO_SUBDOMAIN = "acme";

      const client1 = await getClient();
      const client2 = await getClient();

      expect(client1).toBe(client2);
    });

    it("should create new client when credentials change", async () => {
      const { SyncroClient } = await import("@wyre-technology/node-syncro");
      const mockSyncroClient = vi.mocked(SyncroClient);

      process.env.SYNCRO_API_KEY = "first-api-key";
      process.env.SYNCRO_SUBDOMAIN = "acme";
      await getClient();

      // Verify first call with first credentials
      expect(mockSyncroClient).toHaveBeenCalledWith({
        apiKey: "first-api-key",
        subdomain: "acme",
      });

      // Clear and change credentials
      clearClient();
      mockSyncroClient.mockClear();

      process.env.SYNCRO_API_KEY = "second-api-key";
      await getClient();

      // Verify second call with new credentials
      expect(mockSyncroClient).toHaveBeenCalledWith({
        apiKey: "second-api-key",
        subdomain: "acme",
      });
    });

    it("should create new client when subdomain changes", async () => {
      const { SyncroClient } = await import("@wyre-technology/node-syncro");
      const mockSyncroClient = vi.mocked(SyncroClient);

      process.env.SYNCRO_API_KEY = "test-api-key";
      process.env.SYNCRO_SUBDOMAIN = "company1";
      await getClient();

      // Verify first call
      expect(mockSyncroClient).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        subdomain: "company1",
      });

      // Clear and change subdomain
      clearClient();
      mockSyncroClient.mockClear();

      process.env.SYNCRO_SUBDOMAIN = "company2";
      await getClient();

      // Verify second call with new subdomain
      expect(mockSyncroClient).toHaveBeenCalledWith({
        apiKey: "test-api-key",
        subdomain: "company2",
      });
    });

    it("should throw a clear error when SYNCRO_SUBDOMAIN is missing", async () => {
      process.env.SYNCRO_API_KEY = "test-api-key";
      delete process.env.SYNCRO_SUBDOMAIN;

      await expect(getClient()).rejects.toThrow("SYNCRO_SUBDOMAIN is required");
    });

    // Regression: issue #73 — the blank-field placeholder must NEVER be passed
    // to the SDK (which would build "https://${user_config.syncro_subdomain}
    // .syncromsp.com" and DNS-fail on every request). Instead we fail fast with
    // a clear "required" error and never construct the client.
    it("should reject an unresolved subdomain placeholder instead of building a bogus host", async () => {
      const { SyncroClient } = await import("@wyre-technology/node-syncro");
      const mockSyncroClient = vi.mocked(SyncroClient);

      process.env.SYNCRO_API_KEY = "test-api-key";
      process.env.SYNCRO_SUBDOMAIN = "${user_config.syncro_subdomain}";

      await expect(getClient()).rejects.toThrow("SYNCRO_SUBDOMAIN is required");
      // The placeholder never reached the SDK constructor.
      expect(mockSyncroClient).not.toHaveBeenCalled();
    });
  });

  describe("clearClient", () => {
    it("should clear the cached client", async () => {
      process.env.SYNCRO_API_KEY = "test-api-key";
      process.env.SYNCRO_SUBDOMAIN = "acme";

      const client1 = await getClient();
      clearClient();
      const client2 = await getClient();

      // After clearing, a new client instance should be created
      expect(client1).not.toBe(client2);
    });
  });
});
