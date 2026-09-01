<!-- Platform: substack.com -->
<!-- Post type: newsletter issue -->
<!-- Subject line options below -->

**Subject line options:**
- "I built the USB-C of AI agent trust"
- "Universal Trust Adapter: 12 stages, 8 formats, 1 API"
- "How I'm solving credential verification for AI agents"

**Body:**

# Universal Trust Adapter: the USB-C of AI agent trust

Hey friends —

Quick update. I've been quiet for 3 months because I was building something. Today I'm open-sourcing it.

## What

**Universal Trust Adapter (UTA)** verifies credentials for AI agent tool calls. 8 formats, 12-stage pipeline, 6,744 verifications per second.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
API: https://www.marketnow.site/api/trust

## Why

When an AI agent invokes a tool — an MCP server, an API, a microservice — there's no canonical way to verify *who issued the credential* for that tool. I kept hitting this in production. So I built the thing I wished existed.

## What's next

- More language adapters (Go, Rust, Java native implementations)
- Reputation layer (the question "is this issuer trustworthy?" is separate from "is this credential valid?")
- Conformance certification program

If you're building AI agents, I'd love your feedback.

— Edison
