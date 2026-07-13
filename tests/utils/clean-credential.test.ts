/**
 * Tests for cleanCredential — the MCPB/DXT placeholder sanitiser (issue #73).
 */

import { describe, it, expect } from "vitest";
import { cleanCredential } from "../../src/utils/clean-credential.js";

describe("cleanCredential", () => {
  it("returns a real value unchanged", () => {
    expect(cleanCredential("acme")).toBe("acme");
  });

  it("trims surrounding whitespace from a real value", () => {
    expect(cleanCredential("  acme  ")).toBe("acme");
  });

  it("returns undefined for undefined", () => {
    expect(cleanCredential(undefined)).toBeUndefined();
  });

  it("returns undefined for an empty string", () => {
    expect(cleanCredential("")).toBeUndefined();
  });

  it("returns undefined for a whitespace-only string", () => {
    expect(cleanCredential("   ")).toBeUndefined();
  });

  it("returns undefined for an unresolved MCPB subdomain placeholder", () => {
    expect(cleanCredential("${user_config.syncro_subdomain}")).toBeUndefined();
  });

  it("returns undefined for an unresolved MCPB api key placeholder", () => {
    expect(cleanCredential("${user_config.syncro_api_key}")).toBeUndefined();
  });

  it("returns undefined for a placeholder padded with whitespace", () => {
    expect(cleanCredential("  ${user_config.syncro_subdomain}  ")).toBeUndefined();
  });

  it("keeps a value that merely contains a ${...} fragment but is not solely a placeholder", () => {
    // Not a bare placeholder — a real (if unusual) value should pass through.
    expect(cleanCredential("acme-${x}")).toBe("acme-${x}");
  });
});
