#!/usr/bin/env node
/**
 * Syncro MSP MCP Server
 *
 * This MCP server provides tools for interacting with the Syncro API.
 * All tools are listed upfront so they work with every MCP client, including
 * remote connectors (claude.ai, mcp-remote) that do not support dynamic
 * tool-list changes. A helper `syncro_navigate` tool provides domain
 * discovery and guidance.
 *
 * Supports both stdio and HTTP (StreamableHTTPServerTransport) transports.
 *
 * Credentials are provided via environment variables:
 * - SYNCRO_API_KEY (required)
 * - SYNCRO_SUBDOMAIN (optional)
 *
 * Or via gateway headers (when AUTH_MODE=gateway):
 * - X-Syncro-API-Key
 * - X-Syncro-Subdomain
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getDomainHandler, getAvailableDomains } from "./domains/index.js";
import { isDomainName, type DomainName } from "./utils/types.js";
import { getCredentials } from "./utils/client.js";
import { setServerRef } from "./utils/server-ref.js";
import { credentialStore } from "./utils/credential-store.js";

/**
 * Domain metadata for navigation
 */
const domainDescriptions: Record<DomainName, string> = {
  customers: "Customer management - list, get, create, and update customer accounts and information",
  tickets: "Ticket management - list, get, create, and update support tickets and workflow",
  assets: "Asset management - list and get hardware/software assets and configuration items",
  contacts: "Contact management - list, get, create, and update customer contacts and relationships",
  invoices: "Invoice management - list and get billing and invoice information",
};

/**
 * Navigation / discovery tool - helps the LLM find the right tools
 *
 * This is a stateless helper that describes available tools for a domain.
 * All domain tools are always listed in tools/list regardless of navigation
 * state, because many MCP clients (claude.ai connectors, mcp-remote) only
 * fetch the tool list once and do not support notifications/tools/list_changed.
 */
const navigateTool: Tool = {
  name: "syncro_navigate",
  description:
    "Discover available Syncro tools by domain. Returns tool names and descriptions for the selected domain. All tools are callable at any time — this is a help/discovery aid, not a prerequisite.",
  inputSchema: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        enum: getAvailableDomains(),
        description: `The domain to explore:
- customers: ${domainDescriptions.customers}
- tickets: ${domainDescriptions.tickets}
- assets: ${domainDescriptions.assets}
- contacts: ${domainDescriptions.contacts}
- invoices: ${domainDescriptions.invoices}`,
      },
    },
    required: ["domain"],
  },
};

/**
 * Status tool - shows credentials status and available domains
 */
const statusTool: Tool = {
  name: "syncro_status",
  description: "Show credentials status and available domains",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

/**
 * Map from domain name to its tool definitions (loaded lazily)
 */
const domainToolMap = new Map<DomainName, Tool[]>();

/**
 * All domain tools, collected once at startup
 */
let allDomainTools: Tool[] | null = null;

/**
 * Load all domain tools (lazy-loaded on first access)
 */
async function getAllDomainTools(): Promise<Tool[]> {
  if (allDomainTools !== null) {
    return allDomainTools;
  }

  const domains = getAvailableDomains();
  const tools: Tool[] = [];

  for (const domain of domains) {
    if (!domainToolMap.has(domain)) {
      const handler = await getDomainHandler(domain);
      const domainTools = handler.getTools();
      domainToolMap.set(domain, domainTools);
    }
    tools.push(...domainToolMap.get(domain)!);
  }

  allDomainTools = tools;
  return tools;
}

/**
 * Create a fresh MCP server instance with all handlers registered.
 * Called once for stdio, or per-request for HTTP transport.
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: "syncro-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  setServerRef(server);

  /**
   * Handle ListTools requests - always returns ALL tools
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const domainTools = await getAllDomainTools();
    return { tools: [navigateTool, statusTool, ...domainTools] };
  });

  /**
   * Handle CallTool requests
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      // Handle navigation / discovery helper
      if (name === "syncro_navigate") {
        const { domain } = args as { domain: DomainName };

        if (!isDomainName(domain)) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid domain: ${domain}. Available domains: ${getAvailableDomains().join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        const handler = await getDomainHandler(domain);
        const tools = handler.getTools();

        const toolSummary = tools
          .map((t) => `- ${t.name}: ${t.description}`)
          .join("\n");

        return {
          content: [
            {
              type: "text",
              text: `${domainDescriptions[domain]}\n\nAvailable tools:\n${toolSummary}\n\nYou can call any of these tools directly.`,
            },
          ],
        };
      }

      if (name === "syncro_status") {
        const creds = getCredentials();
        const credStatus = creds
          ? `Configured${creds.subdomain ? ` (subdomain: ${creds.subdomain})` : ""}`
          : "NOT CONFIGURED - Please set SYNCRO_API_KEY environment variable";

        return {
          content: [
            {
              type: "text",
              text: `Syncro MCP Server Status\n\nCredentials: ${credStatus}\nAvailable domains: ${getAvailableDomains().join(", ")}\nRate limit: 180 requests/minute\n\nAll tools are available at all times. Use syncro_navigate to discover tools by domain.`,
            },
          ],
        };
      }

      // Route to appropriate domain handler
      const toolArgs = (args ?? {}) as Record<string, unknown>;

      if (name.startsWith("syncro_customers_")) {
        const handler = await getDomainHandler("customers");
        return await handler.handleCall(name, toolArgs);
      }
      if (name.startsWith("syncro_tickets_")) {
        const handler = await getDomainHandler("tickets");
        return await handler.handleCall(name, toolArgs);
      }
      if (name.startsWith("syncro_assets_")) {
        const handler = await getDomainHandler("assets");
        return await handler.handleCall(name, toolArgs);
      }
      if (name.startsWith("syncro_contacts_")) {
        const handler = await getDomainHandler("contacts");
        return await handler.handleCall(name, toolArgs);
      }
      if (name.startsWith("syncro_invoices_")) {
        const handler = await getDomainHandler("invoices");
        return await handler.handleCall(name, toolArgs);
      }

      // Unknown tool
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}. Use syncro_navigate to discover available tools by domain.`,
          },
        ],
        isError: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Extract gateway credentials from HTTP request headers.
 * Returns the credentials object if present, or null if the required API key is missing.
 */
function extractGatewayCredentials(req: IncomingMessage): { apiKey: string; subdomain?: string } | null {
  const headers = req.headers as Record<string, string | string[] | undefined>;

  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const apiKey = getHeader("x-syncro-api-key");
  if (!apiKey) return null;

  const subdomain = getHeader("x-syncro-subdomain");
  return { apiKey, ...(subdomain ? { subdomain } : {}) };
}

/**
 * Start the HTTP transport with StreamableHTTPServerTransport.
 * Each request gets a fresh Server + Transport (stateless).
 */
async function startHttpTransport(): Promise<void> {
  const port = parseInt(process.env.MCP_HTTP_PORT || "8080", 10);
  const host = process.env.MCP_HTTP_HOST || "0.0.0.0";
  const isGatewayMode = process.env.AUTH_MODE === "gateway";

  const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`
    );

    // Health endpoint - no auth required
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          status: "ok",
          transport: "http",
          authMode: isGatewayMode ? "gateway" : "env",
          timestamp: new Date().toISOString(),
        })
      );
      return;
    }

    // MCP endpoint
    if (url.pathname === "/mcp") {
      // Extract per-request credentials from headers (gateway mode).
      // Credentials are stored in AsyncLocalStorage so concurrent
      // requests are isolated — no process.env mutation.
      let gatewayCreds: { apiKey: string; subdomain?: string } | null = null;
      if (isGatewayMode) {
        gatewayCreds = extractGatewayCredentials(req);
        if (!gatewayCreds) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Missing credentials",
              message:
                "Gateway mode requires X-Syncro-API-Key header",
              required: ["X-Syncro-API-Key"],
              optional: ["X-Syncro-Subdomain"],
            })
          );
          return;
        }
      }

      const handleMcp = () => {
        const server = createMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true,
        });

        res.on("close", () => {
          transport.close();
          server.close();
        });

        server.connect(transport).then(() => {
          transport.handleRequest(req, res);
        });
      };

      if (gatewayCreds) {
        credentialStore.run(gatewayCreds, handleMcp);
      } else {
        handleMcp();
      }
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Not found", endpoints: ["/mcp", "/health"] })
    );
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, host, () => {
      console.error(`Syncro MCP server listening on http://${host}:${port}/mcp`);
      console.error(
        `Health check available at http://${host}:${port}/health`
      );
      console.error(
        `Authentication mode: ${isGatewayMode ? "gateway (header-based)" : "env (environment variables)"}`
      );
      resolve();
    });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.error(`Received ${signal}, shutting down gracefully...`);
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

// Start the server
async function main() {
  const transportType = process.env.MCP_TRANSPORT || "stdio";

  if (transportType === "http") {
    await startHttpTransport();
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Syncro MCP server running on stdio");
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
