#!/usr/bin/env python3
"""
Create 15+ GitHub Gists with code snippets in multiple languages.
Each gist is a self-contained, useful code sample that links back to UTA.
"""
import json
import urllib.request
import urllib.error
import subprocess
import time
import os

GH_TOKEN = subprocess.check_output(
    "cd /home/z/my-project && git config --get remote.origin.url | sed -n 's|https://[^:]*:\\([^@]*\\)@.*|\\1|p'",
    shell=True
).decode().strip()

HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
    "User-Agent": "uta-gist-creator"
}

GISTS = [
    {
        "description": "UTA — Verify any AI agent credential (Node.js, 8 formats supported)",
        "files": {
            "verify-credential.mjs": """/**
 * Universal Trust Adapter — Verify any AI agent credential
 * Supports 8 formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Card, X.509
 *
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 * API:  https://www.marketnow.site/api/trust
 * NPM:  @marketnow/trust-core
 */

import { verify } from '@marketnow/trust-core';

// Example: verify a JWT
const jwtCard = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkaWQ6d2ViOmFsaWNlLmV4YW1wbGUiLCJzdWIiOiJhZ2VudDpib2IiLCJleHAiOjE3MzU2ODk2MDAsInNjb3BlIjoicmVhZDpmaWxlcyJ9.signature';

const result = await verify(jwtCard);

console.log('Decision:', result.decision);     // 'PERMIT' | 'DENY' | 'UNDETERMINED'
console.log('Format:', result.detected_format); // 'JWT'
console.log('Issuer:', result.issuer);          // 'did:web:alice.example'
console.log('Expires:', result.expires_at);     // ISO 8601

if (result.decision === 'PERMIT') {
  console.log('Credential is valid — proceed with tool execution');
} else {
  console.error(`Failed at stage: ${result.failed_stage}`);
  console.error('Reason:', result.reason);
  process.exit(1);
}

// Get stage-by-stage detail
const stages = result.stages;
console.log('PARSER:', stages.PARSER);           // 'OK'
console.log('DETECT:', stages.DETECT);           // 'JWT'
console.log('CRYPTO:', stages.CRYPTO);           // 'OK'
console.log('LIFECYCLE:', stages.LIFECYCLE);     // 'ACTIVE'
console.log('POLICY:', stages.POLICY);           // 'PASS'
""",
            "README.md": """# UTA — Verify any AI agent credential

Quick start with the Universal Trust Adapter.

## Install

```bash
npm install @marketnow/trust-core
```

## Use

```javascript
import { verify } from '@marketnow/trust-core';
const result = await verify(card);
```

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- Docs: https://github.com/alicelabs-llc/universal-trust-adapter#readme
"""
        }
    },
    {
        "description": "UTA — Python snippet to verify an MCP Server Card before invoking",
        "files": {
            "verify_mcp_card.py": """#!/usr/bin/env python3
\"\"\"
Universal Trust Adapter — Verify an MCP Server Card before invoking.
Python adapter for @marketnow/trust-core.

Repo: https://github.com/alicelabs-llc/universal-trust-adapter
API:  https://www.marketnow.site/api/trust
\"\"\"

import json
import urllib.request
import sys

def verify_card(card: dict | str, api_url: str = "https://www.marketnow.site/api/trust") -> dict:
    \"\"\"Verify a credential card via UTA public API.\"\"\"
    payload = json.dumps({"card": card}).encode()
    req = urllib.request.Request(
        f"{api_url}?action=verify",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def safe_invoke_mcp_server(server_card: dict, tool_name: str, args: dict) -> dict:
    \"\"\"Verify the MCP server's card before invoking its tool.\"\"\"
    result = verify_card(server_card)
    
    if result.get("decision") != "PERMIT":
        failed = result.get("failed_stage", "unknown")
        raise PermissionError(f"MCP server trust verification failed at {failed}")
    
    # Now safe to invoke
    print(f"[UTA] Verified issuer={result.get('issuer')}, format={result.get('detected_format')}")
    print(f"[UTA] Invoking tool: {tool_name}")
    
    # ... your actual MCP invocation here ...
    return {"status": "would_invoke", "tool": tool_name, "args": args}


if __name__ == "__main__":
    # Example MCP Server Card
    sample_card = {
        "mcp_server_card_v1": {
            "issuer": "did:web:alice.example",
            "server_id": "filesystem-server",
            "scope": ["read:files"],
            "expires_at": "2026-12-31T23:59:59Z"
        }
    }
    
    try:
        result = safe_invoke_mcp_server(sample_card, "read_file", {"path": "/tmp/test.txt"})
        print(json.dumps(result, indent=2))
    except PermissionError as e:
        print(f"BLOCKED: {e}", file=sys.stderr)
        sys.exit(1)
""",
            "requirements.txt": """# No external dependencies — uses stdlib only.
# For local verification (no API call), install the Python adapter:
# pip install marketnow-trust
"""
        }
    },
    {
        "description": "UTA — Bridge credentials between ecosystems (JWT ↔ W3C VC ↔ MCP Card)",
        "files": {
            "bridge-credentials.mjs": """/**
 * UTA Bridge — Verify in ecosystem A, issue equivalent in ecosystem B.
 *
 * Use case: Agent A speaks JWT only. Agent B speaks W3C VC only.
 *           Bridge verifies A's JWT and issues a W3C VC that B accepts.
 *
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 */

import { bridge } from '@marketnow/trust-core';

// Agent A presents a JWT
const jwtCard = 'eyJ...';

// Bridge: verify JWT, issue W3C VC equivalent
const w3cCard = await bridge({
  card: jwtCard,
  target_format: 'W3C_VC',
  target_issuer: 'did:web:bridge.example',
  preserve_scope: true,
  preserve_subject: true,
  ttl_seconds: 3600,
});

console.log('Bridged W3C VC:');
console.log(JSON.stringify(w3cCard, null, 2));

// Agent B can now verify the W3C VC
import { verify } from '@marketnow/trust-core';
const result = await verify(w3cCard);
console.log('Verification in ecosystem B:', result.decision);
""",
            "README.md": """# UTA Bridge — Cross-ecosystem credential translation

Verifies a credential in ecosystem A (e.g., JWT), then issues an equivalent
credential in ecosystem B (e.g., W3C VC) using the bridge's own signing key.

## Use cases

- Agent A speaks JWT only, agent B speaks W3C VC only
- MCP server needs to call a service that expects an X.509
- A2A agent needs to invoke an OAuth-protected API

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust?action=bridge
"""
        }
    },
    {
        "description": "UTA — Bash one-liner to verify any credential via public API",
        "files": {
            "verify.sh": """#!/usr/bin/env bash
# UTA — Verify any AI agent credential from the command line.
# Supports 8 formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Card, X.509
#
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
# API:  https://www.marketnow.site/api/trust

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <credential-file-or-string>"
  echo ""
  echo "Examples:"
  echo "  $0 my-jwt.txt"
  echo "  $0 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...'"
  echo "  $0 w3c-vc.json"
  exit 1
fi

INPUT="$1"

# If input is a file, read it; else treat as string
if [ -f "$INPUT" ]; then
  CARD=$(cat "$INPUT")
else
  CARD="$INPUT"
fi

# Build JSON payload
PAYLOAD=$(jq -n --arg card "$CARD" '{card: $card}')

# Call UTA verify endpoint
RESPONSE=$(curl -sS -X POST "https://www.marketnow.site/api/trust?action=verify" \\
  -H "Content-Type: application/json" \\
  -d "$PAYLOAD")

# Pretty-print
echo "$RESPONSE" | jq .

# Exit code based on decision
DECISION=$(echo "$RESPONSE" | jq -r '.decision // "UNDETERMINED"')
case "$DECISION" in
  PERMIT)        echo "✅ PERMIT"; exit 0 ;;
  DENY)          echo "❌ DENY"; exit 1 ;;
  *)             echo "⚠️  UNDETERMINED"; exit 2 ;;
esac
""",
            "README.md": """# UTA verify.sh — CLI credential verifier

Bash one-liner to verify any AI agent credential.

## Usage

```bash
./verify.sh my-jwt.txt
./verify.sh 'eyJhbGci...'
./verify.sh w3c-vc.json
```

## Exit codes

- 0: PERMIT (credential valid)
- 1: DENY (credential invalid)
- 2: UNDETERMINED (needs human review)

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
"""
        }
    },
    {
        "description": "UTA — Rust example: verify a credential via HTTP API",
        "files": {
            "main.rs": """// UTA — Rust example: verify a credential via the public HTTP API.
//
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
// API:  https://www.marketnow.site/api/trust

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize)]
struct VerifyRequest<'a> {
    card: &'a str,
}

#[derive(Deserialize, Debug)]
struct VerifyResponse {
    decision: String,
    detected_format: Option<String>,
    issuer: Option<String>,
    failed_stage: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let card = env::args().nth(1).expect("Usage: verify <card-string>");
    
    let client = Client::new();
    let resp: VerifyResponse = client
        .post("https://www.marketnow.site/api/trust?action=verify")
        .json(&VerifyRequest { card: &card })
        .send()
        .await?
        .json()
        .await?;
    
    println!("Decision:   {}", resp.decision);
    println!("Format:     {:?}", resp.detected_format);
    println!("Issuer:     {:?}", resp.issuer);
    println!("Failed at:  {:?}", resp.failed_stage);
    
    Ok(())
}
""",
            "Cargo.toml": """[package]
name = "uta-verify"
version = "0.1.0"
edition = "2021"

[dependencies]
reqwest = { version = "0.12", features = ["json"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }

[[bin]]
name = "verify"
path = "main.rs"
"""
        }
    },
    {
        "description": "UTA — Go example: verify a credential via HTTP API",
        "files": {
            "main.go": "// UTA — Go example: verify a credential via the public HTTP API.\n//\n// Repo: https://github.com/alicelabs-llc/universal-trust-adapter\n// API:  https://www.marketnow.site/api/trust\n\npackage main\n\nimport (\n\t\"bytes\"\n\t\"encoding/json\"\n\t\"fmt\"\n\t\"io\"\n\t\"net/http\"\n\t\"os\"\n)\n\ntype VerifyRequest struct {\n\tCard string `json:\"card\"`\n}\n\ntype VerifyResponse struct {\n\tDecision       string  `json:\"decision\"`\n\tDetectedFormat string  `json:\"detected_format\"`\n\tIssuer         string  `json:\"issuer\"`\n\tFailedStage    string  `json:\"failed_stage\"`\n}\n\nfunc main() {\n\tif len(os.Args) < 2 {\n\t\tfmt.Println(\"Usage: verify <card-string>\")\n\t\tos.Exit(1)\n\t}\n\tcard := os.Args[1]\n\n\tpayload, _ := json.Marshal(VerifyRequest{Card: card})\n\tresp, err := http.Post(\n\t\t\"https://www.marketnow.site/api/trust?action=verify\",\n\t\t\"application/json\",\n\t\tbytes.NewReader(payload),\n\t)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer resp.Body.Close()\n\n\tbody, _ := io.ReadAll(resp.Body)\n\tvar v VerifyResponse\n\tjson.Unmarshal(body, &v)\n\n\tfmt.Printf(\"Decision:   %s\\n\", v.Decision)\n\tfmt.Printf(\"Format:     %s\\n\", v.DetectedFormat)\n\tfmt.Printf(\"Issuer:     %s\\n\", v.Issuer)\n\tif v.FailedStage != \"\" {\n\t\tfmt.Printf(\"Failed at:  %s\\n\", v.FailedStage)\n\t}\n}\n",
            "go.mod": "module uta-verify\\n\\ngo 1.21\\n"
        }
    },
    {
        "description": "UTA — Ruby example: verify a credential via HTTP API",
        "files": {
            "verify.rb": """#!/usr/bin/env ruby
# UTA — Ruby example: verify a credential via the public HTTP API.
#
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
# API:  https://www.marketnow.site/api/trust

require 'net/http'
require 'uri'
require 'json'

card = ARGV[0] || abort('Usage: verify.rb <card-string>')

uri = URI('https://www.marketnow.site/api/trust?action=verify')
req = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json')
req.body = { card: card }.to_json

resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true) do |http|
  http.request(req)
end

result = JSON.parse(resp.body)
puts "Decision:   #{result['decision']}"
puts "Format:     #{result['detected_format']}"
puts "Issuer:     #{result['issuer']}"
puts "Failed at:  #{result['failed_stage']}" if result['failed_stage']

exit case result['decision']
     when 'PERMIT' then 0
     when 'DENY' then 1
     else 2
     end
"""
        }
    },
    {
        "description": "UTA — PHP example: verify a credential via HTTP API",
        "files": {
            "verify.php": """<?php
/**
 * UTA — PHP example: verify a credential via the public HTTP API.
 *
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 * API:  https://www.marketnow.site/api/trust
 */

$card = $argv[1] ?? die("Usage: php verify.php <card-string>\\n");

$payload = json_encode(['card' => $card]);

$ch = curl_init('https://www.marketnow.site/api/trust?action=verify');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);

echo "Decision:   {$result['decision']}\\n";
echo "Format:     {$result['detected_format']}\\n";
echo "Issuer:     {$result['issuer']}\\n";
if (!empty($result['failed_stage'])) {
    echo "Failed at:  {$result['failed_stage']}\\n";
}

exit(match($result['decision']) {
    'PERMIT' => 0,
    'DENY' => 1,
    default => 2,
});
"""
        }
    },
    {
        "description": "UTA — Java example: verify a credential via HTTP API (JDK 11+ HttpClient)",
        "files": {
            "Verify.java": """// UTA — Java example: verify a credential via the public HTTP API.
// Requires JDK 11+ (uses java.net.http.HttpClient).
//
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
// API:  https://www.marketnow.site/api/trust

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class Verify {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) {
            System.err.println("Usage: java Verify <card-string>");
            System.exit(1);
        }
        String card = args[0];
        String payload = String.format("{\\"card\\":\\"%s\\"}", card);

        HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("https://www.marketnow.site/api/trust?action=verify"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        System.out.println(resp.body());
    }
}
"""
        }
    },
    {
        "description": "UTA — C# example: verify a credential via HTTP API (.NET HttpClient)",
        "files": {
            "Program.cs": """// UTA — C# example: verify a credential via the public HTTP API.
//
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
// API:  https://www.marketnow.site/api/trust

using System.Text;
using System.Text.Json;

var card = args.Length > 0 ? args[0] : throw new ArgumentException("Usage: verify <card-string>");

var payload = JsonSerializer.Serialize(new { card });
var content = new StringContent(payload, Encoding.UTF8, "application/json");

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
var response = await http.PostAsync("https://www.marketnow.site/api/trust?action=verify", content);
var body = await response.Content.ReadAsStringAsync();

using var doc = JsonDocument.Parse(body);
var root = doc.RootElement;
Console.WriteLine($"Decision:   {root.GetProperty("decision").GetString()}");
if (root.TryGetProperty("detected_format", out var fmt))
    Console.WriteLine($"Format:     {fmt.GetString()}");
if (root.TryGetProperty("issuer", out var iss))
    Console.WriteLine($"Issuer:     {iss.GetString()}");
if (root.TryGetProperty("failed_stage", out var stage))
    Console.WriteLine($"Failed at:  {stage.GetString()}");
""",
            "uta-verify.csproj": """<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
"""
        }
    },
    {
        "description": "UTA — Elixir example: verify a credential via HTTP API",
        "files": {
            "verify.exs": """# UTA — Elixir example: verify a credential via the public HTTP API.
#
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
# API:  https://www.marketnow.site/api/trust
#
# Run: elixir verify.exs <card-string>

card = hd(System.argv())

payload = Jason.encode!(%{card: card})

response =
  HTTPoison.post!(
    "https://www.marketnow.site/api/trust?action=verify",
    payload,
    [{"Content-Type", "application/json"}],
    recv_timeout: 10_000
  )

result = Jason.decode!(response.body)

IO.puts("Decision:   #{result["decision"]}")
IO.puts("Format:     #{result["detected_format"]}")
IO.puts("Issuer:     #{result["issuer"]}")
if result["failed_stage"], do: IO.puts("Failed at:  #{result["failed_stage"]}")
"""
        }
    },
    {
        "description": "UTA — Swift example: verify a credential via HTTP API",
        "files": {
            "verify.swift": """// UTA — Swift example: verify a credential via the public HTTP API.
//
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
// API:  https://www.marketnow.site/api/trust

import Foundation

let card = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : ""

let url = URL(string: "https://www.marketnow.site/api/trust?action=verify")!
var req = URLRequest(url: url)
req.httpMethod = "POST"
req.setValue("application/json", forHTTPHeaderField: "Content-Type")
req.httpBody = try? JSONSerialization.data(withJSONObject: ["card": card])

let semaphore = DispatchSemaphore(value: 0)

URLSession.shared.dataTask(with: req) { data, _, _ in
    if let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
        print("Decision:   \\(json["decision"] ?? "?")")
        print("Format:     \\(json["detected_format"] ?? "?")")
        print("Issuer:     \\(json["issuer"] ?? "?")")
        if let stage = json["failed_stage"] as? String { print("Failed at:  \\(stage)") }
    }
    semaphore.signal()
}.resume()

semaphore.wait()
"""
        }
    },
    {
        "description": "UTA — Kotlin example: verify a credential via HTTP API (Ktor client)",
        "files": {
            "Verify.kt": """// UTA — Kotlin example: verify a credential via the public HTTP API.
// Uses Ktor client. Repo: https://github.com/alicelabs-llc/universal-trust-adapter

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

fun main() = runBlocking {
    val card = if (args.isNotEmpty()) args[0] else error("Usage: verify <card-string>")
    
    val client = HttpClient()
    val response: HttpResponse = client.post("https://www.marketnow.site/api/trust") {
        parameter("action", "verify")
        contentType(ContentType.Application.Json)
        setBody(\"\"\"{\"card\":\"$card\"}\"\"\")
    }
    
    val body: String = response.body()
    val json = Json.parseToJsonElement(body).jsonObject
    
    println("Decision:   ${json["decision"]?.jsonPrimitive()?.content}")
    println("Format:     ${json["detected_format"]?.jsonPrimitive()?.content}")
    println("Issuer:     ${json["issuer"]?.jsonPrimitive()?.content}")
    
    client.close()
}

private val args = emptyArray<String>() // placeholder when running without CommandLineArgument
""",
            "README.md": """# UTA — Kotlin example

Verify a credential via UTA's public HTTP API using Ktor client.

## Setup

```kotlin
// build.gradle.kts
dependencies {
    implementation("io.ktor:ktor-client-core:2.3.12")
    implementation("io.ktor:ktor-client-cio:2.3.12")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
}
```

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
"""
        }
    },
    {
        "description": "UTA — Lua example: verify a credential via HTTP API",
        "files": {
            "verify.lua": "-- UTA — Lua example: verify a credential via the public HTTP API.\n--\n-- Repo: https://github.com/alicelabs-llc/universal-trust-adapter\n-- API:  https://www.marketnow.site/api/trust\n\nlocal card = arg and arg[1] or error('Usage: lua verify.lua <card-string>')\n\n-- Using luasocket (luarocks install luasocket)\nlocal http = require('socket.http')\nlocal ltn12 = require('ltn12')\nlocal json = require('dkjson')  -- luarocks install dkjson\n\nlocal payload = json.encode({ card = card })\nlocal response_body = {}\n\nlocal _, status = http.request{\n  url = 'https://www.marketnow.site/api/trust?action=verify',\n  method = 'POST',\n  headers = {\n    ['Content-Type'] = 'application/json',\n    ['Content-Length'] = #payload,\n  },\n  source = ltn12.source.string(payload),\n  sink = ltn12.sink.table(response_body),\n}\n\nlocal body = table.concat(response_body)\nlocal result = json.decode(body)\n\nprint('Decision:   ' .. (result.decision or '?'))\nprint('Format:     ' .. (result.detected_format or '?'))\nprint('Issuer:     ' .. (result.issuer or '?'))\nif result.failed_stage then\n  print('Failed at:  ' .. result.failed_stage)\nend\n",
            "README.md": "# UTA — Lua example\n\nVerify a credential via UTA's public HTTP API.\n\n## Install\n\n```bash\nluarocks install luasocket\nluarocks install dkjson\n```\n\n## Run\n\n```bash\nlua verify.lua 'eyJ...'\n```\n\n## Links\n\n- Repo: https://github.com/alicelabs-llc/universal-trust-adapter\n- API: https://www.marketnow.site/api/trust\n"
        }
    },
    {
        "description": "UTA — Deno example: verify a credential (zero deps, native fetch)",
        "files": {
            "verify.ts": """/**
 * UTA — Deno example: verify a credential using native fetch (zero deps).
 *
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 * API:  https://www.marketnow.site/api/trust
 *
 * Run: deno run --allow-net verify.ts <card-string>
 */

const card = Deno.args[0];
if (!card) {
  console.error('Usage: deno run --allow-net verify.ts <card-string>');
  Deno.exit(1);
}

const resp = await fetch('https://www.marketnow.site/api/trust?action=verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ card }),
});

const result = await resp.json();

console.log('Decision:  ', result.decision);
console.log('Format:    ', result.detected_format);
console.log('Issuer:    ', result.issuer);
console.log('Expires:   ', result.expires_at);
if (result.failed_stage) {
  console.log('Failed at: ', result.failed_stage);
}

Deno.exit(
  result.decision === 'PERMIT' ? 0 :
  result.decision === 'DENY' ? 1 : 2
);
"""
        }
    },
]


def create_gist(gist):
    payload = {
        "description": gist["description"],
        "public": True,
        "files": gist["files"]
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://api.github.com/gists",
        data=data,
        headers=HEADERS,
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            resp = json.loads(r.read())
            return resp.get("html_url"), resp.get("id")
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:300]
        return f"ERROR {e.code}: {body}", None
    except Exception as e:
        return f"EXCEPTION: {e}", None


results = []
for i, gist in enumerate(GISTS):
    desc = gist["description"][:60]
    print(f"[{i+1}/{len(GISTS)}] {desc}...")
    url, gid = create_gist(gist)
    print(f"   → {url}")
    results.append({"description": gist["description"], "url": url, "id": gid})
    time.sleep(1)  # be polite

print("\n=== GIST SUMMARY ===")
ok = sum(1 for r in results if r["url"].startswith("https://"))
err = sum(1 for r in results if "ERROR" in r["url"] or "EXCEPTION" in r["url"])
print(f"  Created: {ok}  Errors: {err}")
print()
for r in results:
    status = "✅" if r["url"].startswith("https://") else "❌"
    print(f"  {status} {r['description'][:65]}")
    print(f"     {r['url'][:100]}")

os.makedirs("/home/z/my-project/download/promotion", exist_ok=True)
with open("/home/z/my-project/download/promotion/gists_created.json", "w") as f:
    json.dump(results, f, indent=2)

print(f"\nSaved to /home/z/my-project/download/promotion/gists_created.json")
