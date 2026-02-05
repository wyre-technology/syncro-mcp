/**
 * Tests for the assets domain handler
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { assetsHandler } from "../../src/domains/assets.js";
import * as clientModule from "../../src/utils/client.js";

// Mock the client module
vi.mock("../../src/utils/client.js", () => ({
  getClient: vi.fn(),
  getCredentials: vi.fn(),
  clearClient: vi.fn(),
}));

describe("domains/assets.ts", () => {
  const mockClient = {
    assets: {
      list: vi.fn(),
      get: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(clientModule.getClient).mockResolvedValue(mockClient as never);
  });

  describe("getTools", () => {
    it("should return all asset tools", () => {
      const tools = assetsHandler.getTools();

      expect(tools).toHaveLength(3);
      expect(tools.map((t) => t.name)).toEqual([
        "syncro_assets_list",
        "syncro_assets_get",
        "syncro_assets_search",
      ]);
    });

    it("should define correct input schema for list tool", () => {
      const tools = assetsHandler.getTools();
      const listTool = tools.find((t) => t.name === "syncro_assets_list");

      expect(listTool).toBeDefined();
      expect(listTool!.inputSchema.properties).toHaveProperty("customer_id");
      expect(listTool!.inputSchema.properties).toHaveProperty("asset_type");
      expect(listTool!.inputSchema.properties).toHaveProperty("asset_serial");
      expect(listTool!.inputSchema.properties).toHaveProperty("query");
    });

    it("should mark asset_id as required for get tool", () => {
      const tools = assetsHandler.getTools();
      const getTool = tools.find((t) => t.name === "syncro_assets_get");

      expect(getTool).toBeDefined();
      expect(getTool!.inputSchema.required).toContain("asset_id");
    });

    it("should have search tool with optional filters", () => {
      const tools = assetsHandler.getTools();
      const searchTool = tools.find((t) => t.name === "syncro_assets_search");

      expect(searchTool).toBeDefined();
      expect(searchTool!.inputSchema.properties).toHaveProperty("query");
      expect(searchTool!.inputSchema.properties).toHaveProperty("asset_serial");
      expect(searchTool!.inputSchema.properties).toHaveProperty("customer_id");
      expect(searchTool!.inputSchema.properties).toHaveProperty("limit");
      // Search does not have required fields - all are optional
      expect(searchTool!.inputSchema.required).toBeUndefined();
    });
  });

  describe("handleCall", () => {
    describe("syncro_assets_list", () => {
      it("should list assets with default parameters", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [{ id: 1, name: "Laptop-001" }],
          meta: { total_entries: 1, total_pages: 1, page: 1 },
        });

        const result = await assetsHandler.handleCall("syncro_assets_list", {});

        expect(mockClient.assets.list).toHaveBeenCalledWith({
          customer_id: undefined,
          asset_type: undefined,
          asset_serial: undefined,
          query: undefined,
          page: undefined,
          perPage: undefined,
        });

        const parsed = JSON.parse((result.content[0] as { text: string }).text);
        expect(parsed.total_entries).toBe(1);
        expect(parsed.assets).toHaveLength(1);
      });

      it("should list assets filtered by customer and type", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [
            { id: 1, name: "Server-001", asset_type: "Server" },
            { id: 2, name: "Server-002", asset_type: "Server" },
          ],
          meta: { total_entries: 2, total_pages: 1, page: 1 },
        });

        await assetsHandler.handleCall("syncro_assets_list", {
          customer_id: 123,
          asset_type: "Server",
        });

        expect(mockClient.assets.list).toHaveBeenCalledWith({
          customer_id: 123,
          asset_type: "Server",
          asset_serial: undefined,
          query: undefined,
          page: undefined,
          perPage: undefined,
        });
      });

      it("should list assets filtered by serial number", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [{ id: 1, asset_serial: "ABC123" }],
          meta: { total_entries: 1, total_pages: 1, page: 1 },
        });

        await assetsHandler.handleCall("syncro_assets_list", {
          asset_serial: "ABC123",
        });

        expect(mockClient.assets.list).toHaveBeenCalledWith(
          expect.objectContaining({
            asset_serial: "ABC123",
          })
        );
      });

      it("should support pagination", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [],
          meta: { total_entries: 100, total_pages: 4, page: 3 },
        });

        await assetsHandler.handleCall("syncro_assets_list", {
          page: 3,
          per_page: 25,
        });

        expect(mockClient.assets.list).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 3,
            perPage: 25,
          })
        );
      });
    });

    describe("syncro_assets_get", () => {
      it("should get an asset by ID", async () => {
        const mockAsset = {
          id: 456,
          name: "Workstation-001",
          asset_type: "Desktop",
          asset_serial: "WS001",
          customer_id: 123,
        };
        mockClient.assets.get.mockResolvedValue(mockAsset);

        const result = await assetsHandler.handleCall("syncro_assets_get", {
          asset_id: 456,
        });

        expect(mockClient.assets.get).toHaveBeenCalledWith(456);

        const parsed = JSON.parse((result.content[0] as { text: string }).text);
        expect(parsed.id).toBe(456);
        expect(parsed.name).toBe("Workstation-001");
        expect(parsed.asset_type).toBe("Desktop");
      });
    });

    describe("syncro_assets_search", () => {
      it("should search assets by query", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [{ id: 1, name: "Laptop-A" }, { id: 2, name: "Laptop-B" }],
          meta: { total_entries: 2, total_pages: 1, page: 1 },
        });

        const result = await assetsHandler.handleCall("syncro_assets_search", {
          query: "laptop",
        });

        expect(mockClient.assets.list).toHaveBeenCalledWith({
          query: "laptop",
          asset_serial: undefined,
          customer_id: undefined,
          perPage: 25,
        });

        const parsed = JSON.parse((result.content[0] as { text: string }).text);
        expect(parsed.count).toBe(2);
        expect(parsed.assets).toHaveLength(2);
      });

      it("should search by serial number", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [{ id: 1, asset_serial: "EXACT123" }],
          meta: { total_entries: 1, total_pages: 1, page: 1 },
        });

        await assetsHandler.handleCall("syncro_assets_search", {
          asset_serial: "EXACT123",
        });

        expect(mockClient.assets.list).toHaveBeenCalledWith({
          query: undefined,
          asset_serial: "EXACT123",
          customer_id: undefined,
          perPage: 25,
        });
      });

      it("should search within a specific customer", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [],
          meta: { total_entries: 0, total_pages: 0, page: 1 },
        });

        await assetsHandler.handleCall("syncro_assets_search", {
          query: "server",
          customer_id: 999,
          limit: 50,
        });

        expect(mockClient.assets.list).toHaveBeenCalledWith({
          query: "server",
          asset_serial: undefined,
          customer_id: 999,
          perPage: 50,
        });
      });

      it("should use default limit of 25", async () => {
        mockClient.assets.list.mockResolvedValue({
          assets: [],
          meta: { total_entries: 0, total_pages: 0, page: 1 },
        });

        await assetsHandler.handleCall("syncro_assets_search", {
          query: "test",
        });

        expect(mockClient.assets.list).toHaveBeenCalledWith(
          expect.objectContaining({
            perPage: 25,
          })
        );
      });
    });

    describe("unknown tool", () => {
      it("should return error for unknown tool", async () => {
        const result = await assetsHandler.handleCall("unknown_tool", {});

        expect(result.isError).toBe(true);
        expect((result.content[0] as { text: string }).text).toContain("Unknown asset tool");
      });
    });
  });
});
