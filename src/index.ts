#!/usr/bin/env node
/**
 * Syncro MSP MCP Server with Decision Tree Architecture
 *
 * This MCP server uses a hierarchical tool loading approach:
 * 1. Initially exposes only a navigation tool
 * 2. After user selects a domain, exposes domain-specific tools
 * 3. Lazy-loads domain handlers and the Syncro client
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
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { getDomainHandler, getAvailableDomains } from "./domains/index.js";
import { isDomainName, type DomainName } from "./utils/types.js";
import { getCredentials } from "./utils/client.js";

// Server state
let currentDomain: DomainName | null = null;

// HTTP server reference for graceful shutdown
let httpServer: HttpServer | undefined;

// Create the MCP server
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

/**
 * Navigation tool - always available
 */
const navigateTool: Tool = {
  name: "syncro_navigate",
  description:
    "Navigate to a Syncro domain to access its tools. Available domains: customers (manage customer accounts), tickets (manage support tickets), assets (manage configuration items/devices), contacts (manage customer contacts), invoices (view and manage billing).",
  inputSchema: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        enum: getAvailableDomains(),
        description:
          "The domain to navigate to. Choose: customers, tickets, assets, contacts, or invoices",
      },
    },
    required: ["domain"],
  },
};

/**
 * Back navigation tool - available when in a domain
 */
const backTool: Tool = {
  name: "syncro_back",
  description: "Navigate back to the main menu to select a different domain",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

/**
 * Status tool - shows current navigation state
 */
const statusTool: Tool = {
  name: "syncro_status",
  description:
    "Show current navigation state and available domains. Also verifies API credentials are configured.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

/**
 * Get tools based on current navigation state
 */
async function getToolsForState(): Promise<Tool[]> {
  // Always include status tool
  const tools: Tool[] = [statusTool];

  if (currentDomain === null) {
    // At the root - show navigation tool
    tools.unshift(navigateTool);
  } else {
    // In a domain - show back tool and domain-specific tools
    tools.unshift(backTool);

    const handler = await getDomainHandler(currentDomain);
    const domainTools = handler.getTools();
    tools.push(...domainTools);
  }

  return tools;
}

// Handle ListTools requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await getToolsForState();
  return { tools };
});

// Handle CallTool requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Handle navigation
    if (name === "syncro_navigate") {
      const domain = (args as { domain: string }).domain;

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

      // Check credentials before navigating
      const creds = getCredentials();
      if (!creds) {
        return {
          content: [
            {
              type: "text",
              text: "Error: No API credentials configured. Please set SYNCRO_API_KEY environment variable.",
            },
          ],
          isError: true,
        };
      }

      currentDomain = domain;

      // Get tools for the new domain
      const handler = await getDomainHandler(domain);
      const domainTools = handler.getTools();

      return {
        content: [
          {
            type: "text",
            text: `Navigated to ${domain} domain.\n\nAvailable tools:\n${domainTools
              .map((t) => `- ${t.name}: ${t.description}`)
              .join("\n")}\n\nUse syncro_back to return to the main menu.`,
          },
        ],
      };
    }

    // Handle back navigation
    if (name === "syncro_back") {
      const previousDomain = currentDomain;
      currentDomain = null;

      return {
        content: [
          {
            type: "text",
            text: `Navigated back from ${previousDomain || "root"} to the main menu.\n\nAvailable domains: ${getAvailableDomains().join(", ")}\n\nUse syncro_navigate to select a domain.`,
          },
        ],
      };
    }

    // Handle status
    if (name === "syncro_status") {
      const creds = getCredentials();
      const credStatus = creds
        ? `Configured${creds.subdomain ? ` (subdomain: ${creds.subdomain})` : ""}`
        : "NOT CONFIGURED - Please set SYNCRO_API_KEY environment variable";

      return {
        content: [
          {
            type: "text",
            text: `Syncro MCP Server Status\n\nCurrent domain: ${currentDomain || "(none - at main menu)"}\nCredentials: ${credStatus}\nAvailable domains: ${getAvailableDomains().join(", ")}\nRate limit: 180 requests/minute`,
          },
        ],
      };
    }

    // Handle domain-specific tools
    if (currentDomain !== null) {
      const handler = await getDomainHandler(currentDomain);

      // Check if the tool belongs to this domain
      const domainTools = handler.getTools();
      const toolExists = domainTools.some((t) => t.name === name);

      if (toolExists) {
        return await handler.handleCall(name, args as Record<string, unknown>);
      }
    }

    // Tool not found
    return {
      content: [
        {
          type: "text",
          text: currentDomain
            ? `Unknown tool: ${name}. You are currently in the ${currentDomain} domain. Use syncro_back to return to the main menu.`
            : `Unknown tool: ${name}. Use syncro_navigate to select a domain first.`,
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

/**
 * Extract gateway credentials from HTTP request headers and set them as env vars.
 * Returns true if credentials are present, false if the required API key is missing.
 */
function applyGatewayCredentials(req: IncomingMessage): boolean {
  const headers = req.headers as Record<string, string | string[] | undefined>;

  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const apiKey = getHeader("x-syncro-api-key");
  const subdomain = getHeader("x-syncro-subdomain");

  if (!apiKey) {
    return false;
  }

  // Set env vars so getCredentials() picks them up
  process.env.SYNCRO_API_KEY = apiKey;
  if (subdomain) {
    process.env.SYNCRO_SUBDOMAIN = subdomain;
  }

  return true;
}

/**
 * Start the HTTP transport with StreamableHTTPServerTransport.
 * Supports both env-based and gateway (header-based) credential modes.
 */
async function startHttpTransport(): Promise<void> {
  const port = parseInt(process.env.MCP_HTTP_PORT || "8080", 10);
  const host = process.env.MCP_HTTP_HOST || "0.0.0.0";
  const isGatewayMode = process.env.AUTH_MODE === "gateway";

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });

  httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
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
      // In gateway mode, extract credentials from headers
      if (isGatewayMode) {
        const hasCredentials = applyGatewayCredentials(req);
        if (!hasCredentials) {
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

      transport.handleRequest(req, res);
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Not found", endpoints: ["/mcp", "/health"] })
    );
  });

  await server.connect(transport);

  await new Promise<void>((resolve) => {
    httpServer!.listen(port, host, () => {
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
}

/**
 * Gracefully shut down the server
 */
async function shutdown(signal: string): Promise<void> {
  console.error(`Received ${signal}, shutting down gracefully...`);
  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer!.close((err) => (err ? reject(err) : resolve()));
    });
  }
  await server.close();
  process.exit(0);
}

// Start the server
async function main() {
  const transportType = process.env.MCP_TRANSPORT || "stdio";

  if (transportType === "http") {
    await startHttpTransport();
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Syncro MCP server running on stdio (decision tree mode)");
  }
}

// Graceful shutdown handlers
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

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
