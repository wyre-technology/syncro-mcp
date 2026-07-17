// MCP Resource Handlers for the Syncro MCP Server
// Exposes the MCP Apps (SEP-1865) ticket-card UI via ListResources and
// ReadResource handlers. The card HTML is embedded at build time
// (src/generated/ticket-card-html.ts) so it serves identically from stdio,
// Node HTTP, and the fs-less Cloudflare Workers runtime.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  TICKET_CARD_RESOURCE_URI,
  MCP_APP_RESOURCE_MIME,
  applyBrandInjection,
  resolveBrandFromEnv,
} from "./card.builder.js";
import { TICKET_CARD_HTML } from "./generated/ticket-card-html.js";

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export function listResources(): McpResource[] {
  return [
    {
      uri: TICKET_CARD_RESOURCE_URI,
      name: "Syncro Ticket Card",
      description: "Interactive MCP Apps card rendering a Syncro MSP ticket",
      mimeType: MCP_APP_RESOURCE_MIME,
    },
  ];
}

export function readResource(uri: string): McpResourceContent {
  if (uri === TICKET_CARD_RESOURCE_URI) {
    return {
      uri,
      mimeType: MCP_APP_RESOURCE_MIME,
      // Neutral by default; MCP_BRAND_* env vars inject a per-operator brand
      // at serve time (no rebuild needed). Empty brand = HTML served as-is.
      text: applyBrandInjection(TICKET_CARD_HTML, resolveBrandFromEnv()),
    };
  }
  throw new Error(`Unknown resource: ${uri}`);
}

export function registerResourceHandlers(server: Server): void {
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResources(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
    contents: [readResource(request.params.uri)],
  }));
}
