/**
 * Assets domain handler
 *
 * Provides tools for asset/configuration item operations in Syncro MSP.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { DomainHandler, CallToolResult } from "../utils/types.js";
import { getClient } from "../utils/client.js";

/**
 * Get asset domain tools
 */
function getTools(): Tool[] {
  return [
    {
      name: "syncro_assets_list",
      description:
        "List assets/configuration items in Syncro. Can filter by customer, asset type, or serial number.",
      inputSchema: {
        type: "object" as const,
        properties: {
          customer_id: {
            type: "number",
            description: "Filter assets by customer ID",
          },
          asset_type: {
            type: "string",
            description:
              "Filter by asset type (e.g., Desktop, Laptop, Server, Network Device)",
          },
          asset_serial: {
            type: "string",
            description: "Filter by serial number",
          },
          query: {
            type: "string",
            description: "Search query string",
          },
          page: {
            type: "number",
            description: "Page number for pagination (default: 1)",
          },
          per_page: {
            type: "number",
            description: "Results per page (default: 25)",
          },
        },
      },
    },
    {
      name: "syncro_assets_get",
      description: "Get details for a specific asset by its ID",
      inputSchema: {
        type: "object" as const,
        properties: {
          asset_id: {
            type: "number",
            description: "The asset ID",
          },
        },
        required: ["asset_id"],
      },
    },
    {
      name: "syncro_assets_search",
      description:
        "Search for assets using a query string or serial number. Useful for finding devices by name, serial, or other attributes.",
      inputSchema: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Search query string",
          },
          asset_serial: {
            type: "string",
            description: "Search by exact serial number",
          },
          customer_id: {
            type: "number",
            description: "Limit search to a specific customer",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 25)",
          },
        },
      },
    },
  ];
}

/**
 * Handle an asset domain tool call
 */
async function handleCall(
  toolName: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  const client = await getClient();

  switch (toolName) {
    case "syncro_assets_list": {
      const response = await client.assets.list({
        customer_id: args.customer_id as number | undefined,
        asset_type: args.asset_type as string | undefined,
        asset_serial: args.asset_serial as string | undefined,
        query: args.query as string | undefined,
        page: args.page as number | undefined,
        perPage: args.per_page as number | undefined,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total_entries: response.meta.total_entries,
                total_pages: response.meta.total_pages,
                current_page: response.meta.page,
                assets: response.assets,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    case "syncro_assets_get": {
      const assetId = args.asset_id as number;
      const asset = await client.assets.get(assetId);

      return {
        content: [{ type: "text", text: JSON.stringify(asset, null, 2) }],
      };
    }

    case "syncro_assets_search": {
      const limit = (args.limit as number) || 25;

      const response = await client.assets.list({
        query: args.query as string | undefined,
        asset_serial: args.asset_serial as string | undefined,
        customer_id: args.customer_id as number | undefined,
        perPage: limit,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: response.assets.length,
                assets: response.assets,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `Unknown asset tool: ${toolName}` }],
        isError: true,
      };
  }
}

export const assetsHandler: DomainHandler = {
  getTools,
  handleCall,
};
