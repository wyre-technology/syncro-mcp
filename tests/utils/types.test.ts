/**
 * Tests for shared types and utilities
 */

import { describe, it, expect } from "vitest";
import { isDomainName, type DomainName } from "../../src/utils/types.js";

describe("types.ts", () => {
  describe("isDomainName", () => {
    it("should return true for valid domain names", () => {
      const validDomains: DomainName[] = [
        "customers",
        "tickets",
        "assets",
        "contacts",
        "invoices",
      ];

      validDomains.forEach((domain) => {
        expect(isDomainName(domain)).toBe(true);
      });
    });

    it("should return false for invalid domain names", () => {
      const invalidDomains = [
        "invalid",
        "CUSTOMERS",
        "Tickets",
        "asset",
        "",
        "  ",
        "users",
        "products",
        "settings",
      ];

      invalidDomains.forEach((domain) => {
        expect(isDomainName(domain)).toBe(false);
      });
    });

    it("should narrow type correctly", () => {
      const value: string = "customers";

      if (isDomainName(value)) {
        // TypeScript should recognize this as DomainName
        const domain: DomainName = value;
        expect(domain).toBe("customers");
      } else {
        // This should not execute
        expect.fail("Should have recognized 'customers' as a valid domain");
      }
    });
  });
});
