/**
 * HTTP Transport Tests
 *
 * Tests the HTTP server routing, health endpoint, gateway authentication,
 * and error handling for the Syncro MCP server's HTTP transport mode.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import type { Server as HttpServer, AddressInfo } from "node:http";

// We test the HTTP routing logic by recreating the handler in isolation,
// rather than importing the full server (which has side effects).

/** Simulated gateway credential extraction */
function applyGatewayCredentials(req: IncomingMessage): boolean {
  const headers = req.headers as Record<string, string | string[] | undefined>;

  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const apiKey = getHeader("x-syncro-api-key");
  if (!apiKey) {
    return false;
  }

  process.env.SYNCRO_API_KEY = apiKey;
  const subdomain = getHeader("x-syncro-subdomain");
  if (subdomain) {
    process.env.SYNCRO_SUBDOMAIN = subdomain;
  }

  return true;
}

/**
 * Create a test HTTP server that mimics the syncro-mcp HTTP routing logic.
 * This avoids importing the actual index.ts (which starts the MCP server).
 */
function createTestServer(isGatewayMode: boolean): HttpServer {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(
      req.url || "/",
      `http://${req.headers.host || "localhost"}`
    );

    // Health endpoint
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
      if (isGatewayMode) {
        const hasCredentials = applyGatewayCredentials(req);
        if (!hasCredentials) {
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Missing credentials",
              message: "Gateway mode requires X-Syncro-API-Key header",
              required: ["X-Syncro-API-Key"],
              optional: ["X-Syncro-Subdomain"],
            })
          );
          return;
        }
      }

      // In a real server, transport.handleRequest(req, res) would be called here.
      // For testing, we return a 200 to indicate the route was matched.
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "mcp-endpoint-reached" }));
      return;
    }

    // 404 for everything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ error: "Not found", endpoints: ["/mcp", "/health"] })
    );
  });
}

/** Helper to make HTTP requests against the test server */
async function request(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, options);
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

describe("HTTP Transport - env mode", () => {
  let testServer: HttpServer;
  let baseUrl: string;

  beforeAll(async () => {
    testServer = createTestServer(false);
    await new Promise<void>((resolve) => {
      testServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = testServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      testServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("should return 200 with correct JSON from /health", async () => {
    const { status, body } = await request(baseUrl, "/health");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.transport).toBe("http");
    expect(body.authMode).toBe("env");
    expect(body.timestamp).toBeDefined();
  });

  it("should accept POST requests to /mcp", async () => {
    const { status, body } = await request(baseUrl, "/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(status).toBe(200);
    expect(body.status).toBe("mcp-endpoint-reached");
  });

  it("should return 404 for unknown routes", async () => {
    const { status, body } = await request(baseUrl, "/unknown");
    expect(status).toBe(404);
    expect(body.error).toBe("Not found");
    expect(body.endpoints).toEqual(["/mcp", "/health"]);
  });

  it("should return 404 for root path", async () => {
    const { status } = await request(baseUrl, "/");
    expect(status).toBe(404);
  });
});

describe("HTTP Transport - gateway mode", () => {
  let testServer: HttpServer;
  let baseUrl: string;

  beforeAll(async () => {
    testServer = createTestServer(true);
    await new Promise<void>((resolve) => {
      testServer.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = testServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      testServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    // Clean up env vars between tests
    delete process.env.SYNCRO_API_KEY;
    delete process.env.SYNCRO_SUBDOMAIN;
  });

  it("should return 401 when gateway credentials are missing", async () => {
    const { status, body } = await request(baseUrl, "/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(status).toBe(401);
    expect(body.error).toBe("Missing credentials");
    expect(body.required).toEqual(["X-Syncro-API-Key"]);
  });

  it("should accept requests with valid gateway headers", async () => {
    const { status, body } = await request(baseUrl, "/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-syncro-api-key": "test-api-key-123",
        "x-syncro-subdomain": "test-company",
      },
      body: JSON.stringify({}),
    });
    expect(status).toBe(200);
    expect(body.status).toBe("mcp-endpoint-reached");
    // Verify credentials were applied to env
    expect(process.env.SYNCRO_API_KEY).toBe("test-api-key-123");
    expect(process.env.SYNCRO_SUBDOMAIN).toBe("test-company");
  });

  it("should accept requests with only the required API key header", async () => {
    const { status, body } = await request(baseUrl, "/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-syncro-api-key": "another-key",
      },
      body: JSON.stringify({}),
    });
    expect(status).toBe(200);
    expect(body.status).toBe("mcp-endpoint-reached");
    expect(process.env.SYNCRO_API_KEY).toBe("another-key");
  });

  it("should still serve /health without credentials in gateway mode", async () => {
    const { status, body } = await request(baseUrl, "/health");
    expect(status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.authMode).toBe("gateway");
  });

  it("should return 404 for unknown routes in gateway mode", async () => {
    const { status } = await request(baseUrl, "/not-a-route");
    expect(status).toBe(404);
  });
});

describe("applyGatewayCredentials", () => {
  beforeEach(() => {
    delete process.env.SYNCRO_API_KEY;
    delete process.env.SYNCRO_SUBDOMAIN;
  });

  it("should return false when api key header is missing", () => {
    const mockReq = { headers: {} } as IncomingMessage;
    expect(applyGatewayCredentials(mockReq)).toBe(false);
  });

  it("should return true and set env when api key header is present", () => {
    const mockReq = {
      headers: { "x-syncro-api-key": "my-key" },
    } as unknown as IncomingMessage;
    expect(applyGatewayCredentials(mockReq)).toBe(true);
    expect(process.env.SYNCRO_API_KEY).toBe("my-key");
  });

  it("should set subdomain env when header is present", () => {
    const mockReq = {
      headers: {
        "x-syncro-api-key": "my-key",
        "x-syncro-subdomain": "my-company",
      },
    } as unknown as IncomingMessage;
    applyGatewayCredentials(mockReq);
    expect(process.env.SYNCRO_SUBDOMAIN).toBe("my-company");
  });
});
