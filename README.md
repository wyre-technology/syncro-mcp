# Syncro MCP Server

A Model Context Protocol (MCP) server for Syncro MSP, implementing a decision tree architecture for efficient tool navigation.


## One-Click Deployment

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/wyre-technology/syncro-mcp/tree/main)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wyre-technology/syncro-mcp)

## Features

- **Decision Tree Architecture**: Tools are organized by domain and loaded lazily
- **Domain Navigation**: Navigate between customers, tickets, assets, contacts, and invoices
- **Lazy Loading**: Domain handlers and the Syncro client are loaded on-demand
- **Full Syncro API Coverage**: Access to key Syncro MSP functionality

## Installation

```bash
npm install @wyre-technology/syncro-mcp
```

## Configuration

Set the following environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SYNCRO_API_KEY` | Yes | Your Syncro API key |
| `SYNCRO_SUBDOMAIN` | No | Your Syncro subdomain (if applicable) |

### Getting Your API Key

1. Log in to your Syncro MSP account
2. Navigate to Settings > API Tokens
3. Generate a new API token with appropriate permissions

## Usage

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "syncro": {
      "command": "npx",
      "args": ["@wyre-technology/syncro-mcp"],
      "env": {
        "SYNCRO_API_KEY": "your-api-key"
      }
    }
  }
}
```

### With Docker

```bash
docker build --secret id=npmrc,src=$HOME/.npmrc -t syncro-mcp .

docker run -e SYNCRO_API_KEY=your-api-key syncro-mcp
```

## Architecture

### Decision Tree Navigation

The server uses a hierarchical approach to tool discovery:

1. **Initial State**: Only navigation and status tools are exposed
2. **After Navigation**: Domain-specific tools become available
3. **Back Navigation**: Return to the main menu to switch domains

This reduces cognitive load and improves LLM tool selection accuracy.

### Available Domains

| Domain | Description | Tools |
|--------|-------------|-------|
| `customers` | Manage customer accounts | list, get, create, search |
| `tickets` | Manage support tickets | list, get, create, update, add_comment |
| `assets` | Manage configuration items | list, get, search |
| `contacts` | Manage customer contacts | list, get, create |
| `invoices` | View and manage billing | list, get, create, email |

## Tools Reference

### Navigation Tools

#### syncro_navigate
Navigate to a domain to access its tools.

```json
{
  "domain": "customers" | "tickets" | "assets" | "contacts" | "invoices"
}
```

#### syncro_back
Return to the main menu from any domain.

#### syncro_status
Show current navigation state and credential status.

### Customers Domain

#### syncro_customers_list
List customers with optional filters.

```json
{
  "query": "search term",
  "business_name": "Company Inc",
  "email": "contact@example.com",
  "include_disabled": false,
  "page": 1,
  "per_page": 25
}
```

#### syncro_customers_get
Get a specific customer by ID.

```json
{
  "customer_id": 123
}
```

#### syncro_customers_create
Create a new customer.

```json
{
  "business_name": "Acme Corp",
  "firstname": "John",
  "lastname": "Doe",
  "email": "john@acme.com"
}
```

#### syncro_customers_search
Search customers by query string.

```json
{
  "query": "acme",
  "limit": 25
}
```

### Tickets Domain

#### syncro_tickets_list
List tickets with optional filters.

```json
{
  "customer_id": 123,
  "status": "Open",
  "user_id": 456,
  "resolved": false
}
```

#### syncro_tickets_get
Get a specific ticket by ID.

```json
{
  "ticket_id": 789
}
```

#### syncro_tickets_create
Create a new ticket.

```json
{
  "customer_id": 123,
  "subject": "Network Issue",
  "problem_type": "Network",
  "comment_body": "Initial description"
}
```

#### syncro_tickets_update
Update an existing ticket.

```json
{
  "ticket_id": 789,
  "status": "Resolved",
  "user_id": 456
}
```

#### syncro_tickets_add_comment
Add a comment to a ticket.

```json
{
  "ticket_id": 789,
  "body": "Comment text",
  "hidden": false
}
```

### Assets Domain

#### syncro_assets_list
List assets with optional filters.

```json
{
  "customer_id": 123,
  "asset_type": "Desktop"
}
```

#### syncro_assets_get
Get a specific asset by ID.

```json
{
  "asset_id": 456
}
```

#### syncro_assets_search
Search assets by query or serial number.

```json
{
  "query": "workstation",
  "asset_serial": "SN12345"
}
```

### Contacts Domain

#### syncro_contacts_list
List contacts with optional filters.

```json
{
  "customer_id": 123,
  "query": "john"
}
```

#### syncro_contacts_get
Get a specific contact by ID.

```json
{
  "contact_id": 789
}
```

#### syncro_contacts_create
Create a new contact.

```json
{
  "customer_id": 123,
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

### Invoices Domain

#### syncro_invoices_list
List invoices with optional filters.

```json
{
  "customer_id": 123,
  "status": "sent",
  "since_date": "2024-01-01"
}
```

#### syncro_invoices_get
Get a specific invoice by ID.

```json
{
  "invoice_id": 456
}
```

#### syncro_invoices_create
Create a new invoice.

```json
{
  "customer_id": 123,
  "due_date": "2024-02-01"
}
```

#### syncro_invoices_email
Email an invoice to the customer.

```json
{
  "invoice_id": 456,
  "subject": "Your Invoice"
}
```

## Rate Limiting

Syncro API has a rate limit of 180 requests per minute. The underlying `@wyre-technology/node-syncro` library handles rate limiting automatically.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

Apache-2.0
