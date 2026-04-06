## [1.1.5](https://github.com/wyre-technology/syncro-mcp/compare/v1.1.4...v1.1.5) (2026-04-06)


### Bug Fixes

* per-request MCP Server+Transport for gateway compatibility ([3f8f15e](https://github.com/wyre-technology/syncro-mcp/commit/3f8f15ecbfb3f6e8942c55ec3ea28a64635d8ec4))

## [1.1.4](https://github.com/wyre-technology/syncro-mcp/compare/v1.1.3...v1.1.4) (2026-04-03)


### Bug Fixes

* **deploy:** replace node_compat with nodejs_compat for Wrangler v4 ([13b5e11](https://github.com/wyre-technology/syncro-mcp/commit/13b5e11d0cbd4f60ab67608aee7ce9fe36fe2554))

## [1.1.3](https://github.com/wyre-technology/syncro-mcp/compare/v1.1.2...v1.1.3) (2026-03-10)


### Bug Fixes

* **ci:** add contents:write permission for MCPB upload ([ed14585](https://github.com/wyre-technology/syncro-mcp/commit/ed1458521c699f722b6d2dec71816cd78e64555e))

## [1.1.2](https://github.com/wyre-technology/syncro-mcp/compare/v1.1.1...v1.1.2) (2026-03-10)


### Bug Fixes

* **ci:** install deps before MCPB pack step in docker job ([9292693](https://github.com/wyre-technology/syncro-mcp/commit/929269352dba926610959ee468566b0e4258e213))

## [1.1.1](https://github.com/wyre-technology/syncro-mcp/compare/v1.1.0...v1.1.1) (2026-03-10)


### Bug Fixes

* **docker:** pass GitHub Packages auth token to Docker build via BuildKit secret ([c0c3a9e](https://github.com/wyre-technology/syncro-mcp/commit/c0c3a9ec720aa8e513d9c713f3304c20344da00b))

# [1.1.0](https://github.com/wyre-technology/syncro-mcp/compare/v1.0.0...v1.1.0) (2026-03-10)


### Features

* **elicitation:** add MCP elicitation support with graceful fallback ([14ca9ef](https://github.com/wyre-technology/syncro-mcp/commit/14ca9ef060ddfcf4546e7be330b8e2db21ed7c79))

# 1.0.0 (2026-03-02)


### Bug Fixes

* **ci:** add GitHub Packages auth for npm ci ([03ef2ce](https://github.com/wyre-technology/syncro-mcp/commit/03ef2ced57820dee74dade67660fd5eb08ff0316))
* **ci:** convert pack-mcpb.js to ESM imports ([d018565](https://github.com/wyre-technology/syncro-mcp/commit/d0185652c6c29941b85aa4e3fecb323c907f7be1))
* **ci:** fix broken YAML in Discord notification step ([0daf7ec](https://github.com/wyre-technology/syncro-mcp/commit/0daf7ec26c909cd9b803f570869c3aeba8c99117))
* **ci:** move Discord notification into release workflow ([8379c80](https://github.com/wyre-technology/syncro-mcp/commit/8379c802a4bd30b2dc09ed59b6e7272ab40ff17a))
* **ci:** update lock file and bump node to 22 ([6a534ec](https://github.com/wyre-technology/syncro-mcp/commit/6a534ec808e1c63190d96389cb5cc143313a67fe))
* correct mock package name from @asachs01/node-syncro to @wyre-technology/node-syncro ([67e2d33](https://github.com/wyre-technology/syncro-mcp/commit/67e2d3329ec42cf32cfb72076f840856955b3910))
* **docker:** drop arm64 platform to fix QEMU build failures ([5d740fd](https://github.com/wyre-technology/syncro-mcp/commit/5d740fd6cabe325474728c6d7f2cad4358b83619))
* escape newlines in .releaserc.json message template ([5551cbe](https://github.com/wyre-technology/syncro-mcp/commit/5551cbe01d172bbb56c6c16cf474c93e20ee2227))
* quote MCPB bundle filename to prevent shell glob expansion failure ([ee2f3c8](https://github.com/wyre-technology/syncro-mcp/commit/ee2f3c8ef811c8618b5ea429949eb08b0af3a2d3))
* rename duplicate step id in docker job ([d99f703](https://github.com/wyre-technology/syncro-mcp/commit/d99f703bd5e5ee6a54980d19c5cc247b27aeab10))


### Features

* add MCPB manifest for desktop installation ([b5e6aca](https://github.com/wyre-technology/syncro-mcp/commit/b5e6aca36a956ce8b5aa98ad371e4aa7fe6f15ab))
* add MCPB pack script ([de637e1](https://github.com/wyre-technology/syncro-mcp/commit/de637e1966ad1bdaa07ba13dab52a41b54feee91))
* add mcpb packaging support ([0a095d5](https://github.com/wyre-technology/syncro-mcp/commit/0a095d5565513b7db5e5a219b3c95733d0234a9f))
* add mcpb packaging support ([d2744fa](https://github.com/wyre-technology/syncro-mcp/commit/d2744fae7df9eb816cdaad7ad184dc500ae804c5))
* add mcpb packaging support ([a73bae3](https://github.com/wyre-technology/syncro-mcp/commit/a73bae3ad14546083d8991943b197e1e4ff4061b))
* add mcpb packaging support ([ccdfe8e](https://github.com/wyre-technology/syncro-mcp/commit/ccdfe8e33c36ff135a6633b6013c8b1c47bb9578))
* add mcpb packaging support ([53a2452](https://github.com/wyre-technology/syncro-mcp/commit/53a245258b7229d915eaf7da94327a9107db8bdc))
* add one-click deploy badges to README ([af443da](https://github.com/wyre-technology/syncro-mcp/commit/af443da1d2bd4a4f43933b0a2be50e358e46dcd8))
* Implement Syncro MCP server with decision tree architecture ([cbc4b37](https://github.com/wyre-technology/syncro-mcp/commit/cbc4b3783e658d0197611535b6751499b1f687b4))
* **transport:** Add HTTP transport, Docker, and deployment configs ([fa30756](https://github.com/wyre-technology/syncro-mcp/commit/fa30756899197aa6ea2ab4b54d33770d6abc97f9))
