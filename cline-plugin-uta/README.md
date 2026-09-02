# @alicelabs/cline-trust-plugin

Trust verification plugin for Cline — wraps MCP servers with pre-exec filter, credential protection, and Merkle tree audit log.

## What it does

1. **Blocks dangerous calls** — `.env` reads, `rm -rf`, `DROP TABLE`, shell spawns, credential file access
2. **Verifies trust** — checks any MCP server's trust score via the UTA API
3. **Audit log** — tamper-evident Merkle tree of every intercepted call
4. **Scans servers** — checks against 9,248 MCP skills scanned for threats

## Install

```bash
npm install @alicelabs/cline-trust-plugin
```

Then add to your Cline plugin config:

```json
{
  "plugins": [
    {
      "name": "uta-trust-gateway",
      "path": "@alicelabs/cline-trust-plugin"
    }
  ]
}
```

## Tools provided

| Tool | Description |
|---|---|
| `verify_trust` | Verify trust score of any MCP server or credential |
| `check_interceptor` | Check if a tool call would be blocked |
| `get_audit_log` | Get Merkle tree audit log |
| `scan_mcp_server` | Scan MCP server for security threats |

## License

AL-1.0 (AliceLabs Source-Available License)

## Links

- Website: https://www.marketnow.site
- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- npm: @marketnow/trust-gateway
- Status: https://status.marketnow.site
