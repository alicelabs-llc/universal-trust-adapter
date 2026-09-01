#!/usr/bin/env python3
"""
Generate 15 code snippet files in /home/z/my-project/uta-repo/snippets/
Each snippet is a self-contained UTA usage example in a different language.
Then commits and pushes to the repo.
"""
import os
import json
import subprocess

SNIPPETS_DIR = "/home/z/my-project/uta-repo/snippets"
os.makedirs(SNIPPETS_DIR, exist_ok=True)

SNIPPETS = [
    ("nodejs", "verify-credential.mjs", """/**
 * Universal Trust Adapter — Verify any AI agent credential (Node.js)
 * Supports 8 formats: ATC v3, JWT, W3C VC, A2A, EAT-AI, ZTA, MCP Card, X.509
 *
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 * API:  https://www.marketnow.site/api/trust
 * NPM:  @marketnow/trust-core
 */

import { verify } from '@marketnow/trust-core';

const jwtCard = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...';

const result = await verify(jwtCard);

console.log('Decision:', result.decision);     // 'PERMIT' | 'DENY' | 'UNDETERMINED'
console.log('Format:', result.detected_format); // 'JWT'
console.log('Issuer:', result.issuer);

if (result.decision === 'PERMIT') {
  console.log('Credential valid — proceed with tool execution');
} else {
  console.error(`Failed at stage: ${result.failed_stage}`);
  process.exit(1);
}
"""),
    ("python", "verify_mcp_card.py", """#!/usr/bin/env python3
\"\"\"
UTA — Verify an MCP Server Card before invoking (Python).
Repo: https://github.com/alicelabs-llc/universal-trust-adapter
\"\"\"
import json, urllib.request, sys

def verify_card(card, api_url="https://www.marketnow.site/api/trust"):
    payload = json.dumps({"card": card}).encode()
    req = urllib.request.Request(f"{api_url}?action=verify", data=payload,
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def safe_invoke_mcp_server(server_card, tool_name, args):
    result = verify_card(server_card)
    if result.get("decision") != "PERMIT":
        failed = result.get("failed_stage", "unknown")
        raise PermissionError(f"MCP trust verification failed at {failed}")
    print(f"[UTA] Verified issuer={result.get('issuer')}")
    return {"status": "would_invoke", "tool": tool_name, "args": args}

if __name__ == "__main__":
    sample_card = {"mcp_server_card_v1": {"issuer": "did:web:alice.example",
        "server_id": "filesystem-server", "scope": ["read:files"]}}
    try:
        r = safe_invoke_mcp_server(sample_card, "read_file", {"path": "/tmp/test.txt"})
        print(json.dumps(r, indent=2))
    except PermissionError as e:
        print(f"BLOCKED: {e}", file=sys.stderr); sys.exit(1)
"""),
    ("nodejs", "bridge-credentials.mjs", """/**
 * UTA Bridge — Verify in ecosystem A, issue equivalent in B (Node.js).
 * Use case: Agent A speaks JWT, Agent B speaks W3C VC.
 */
import { bridge, verify } from '@marketnow/trust-core';

const jwtCard = 'eyJ...';
const w3cCard = await bridge({
  card: jwtCard,
  target_format: 'W3C_VC',
  target_issuer: 'did:web:bridge.example',
  preserve_scope: true,
  preserve_subject: true,
  ttl_seconds: 3600,
});
console.log('Bridged W3C VC:', JSON.stringify(w3cCard, null, 2));
const result = await verify(w3cCard);
console.log('Verification in ecosystem B:', result.decision);
"""),
    ("bash", "verify.sh", """#!/usr/bin/env bash
# UTA — Verify any AI agent credential from the command line.
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
set -euo pipefail
[ $# -lt 1 ] && { echo "Usage: $0 <credential-file-or-string>"; exit 1; }
INPUT="$1"
if [ -f "$INPUT" ]; then CARD=$(cat "$INPUT"); else CARD="$INPUT"; fi
PAYLOAD=$(jq -n --arg card "$CARD" '{card: $card}')
RESPONSE=$(curl -sS -X POST "https://www.marketnow.site/api/trust?action=verify" \\
  -H "Content-Type: application/json" -d "$PAYLOAD")
echo "$RESPONSE" | jq .
DECISION=$(echo "$RESPONSE" | jq -r '.decision // "UNDETERMINED"')
case "$DECISION" in
  PERMIT) echo "OK PERMIT"; exit 0 ;;
  DENY)   echo "FAIL DENY"; exit 1 ;;
  *)      echo "WARN UNDETERMINED"; exit 2 ;;
esac
"""),
    ("rust", "main.rs", """// UTA — Rust example: verify a credential via public HTTP API.
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize)] struct VerifyRequest<'a> { card: &'a str }
#[derive(Deserialize, Debug)] struct VerifyResponse {
    decision: String,
    detected_format: Option<String>,
    issuer: Option<String>,
    failed_stage: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let card = env::args().nth(1).expect("Usage: verify <card>");
    let client = Client::new();
    let resp: VerifyResponse = client
        .post("https://www.marketnow.site/api/trust?action=verify")
        .json(&VerifyRequest { card: &card })
        .send().await?.json().await?;
    println!("Decision:  {}", resp.decision);
    println!("Format:    {:?}", resp.detected_format);
    println!("Issuer:    {:?}", resp.issuer);
    Ok(())
}
"""),
    ("go", "main.go", "// UTA — Go example: verify a credential via public HTTP API.\\n// Repo: https://github.com/alicelabs-llc/universal-trust-adapter\\npackage main\\n\\nimport (\\n\\t\\\"bytes\\\"\\n\\t\\\"encoding/json\\\"\\n\\t\\\"fmt\\\"\\n\\t\\\"io\\\"\\n\\t\\\"net/http\\\"\\n\\t\\\"os\\\"\\n)\\n\\ntype VerifyRequest struct {\\n\\tCard string `json:\\\"card\\\"`\\n}\\n\\ntype VerifyResponse struct {\\n\\tDecision       string `json:\\\"decision\\\"`\\n\\tDetectedFormat string `json:\\\"detected_format\\\"`\\n\\tIssuer         string `json:\\\"issuer\\\"`\\n\\tFailedStage    string `json:\\\"failed_stage\\\"`\\n}\\n\\nfunc main() {\\n\\tif len(os.Args) < 2 { fmt.Println(\\\"Usage: verify <card-string>\\\"); os.Exit(1) }\\n\\tcard := os.Args[1]\\n\\tpayload, _ := json.Marshal(VerifyRequest{Card: card})\\n\\tresp, err := http.Post(\\n\\t\\t\\\"https://www.marketnow.site/api/trust?action=verify\\\",\\n\\t\\t\\\"application/json\\\",\\n\\t\\tbytes.NewReader(payload),\\n\\t)\\n\\tif err != nil { panic(err) }\\n\\tdefer resp.Body.Close()\\n\\tbody, _ := io.ReadAll(resp.Body)\\n\\tvar v VerifyResponse\\n\\tjson.Unmarshal(body, &v)\\n\\tfmt.Printf(\\\"Decision:   %s\\\\n\\\", v.Decision)\\n\\tfmt.Printf(\\\"Format:     %s\\\\n\\\", v.DetectedFormat)\\n\\tfmt.Printf(\\\"Issuer:     %s\\\\n\\\", v.Issuer)\\n}\\n"),
    ("ruby", "verify.rb", """#!/usr/bin/env ruby
# UTA — Ruby example: verify a credential via public HTTP API.
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
require 'net/http'
require 'uri'
require 'json'

card = ARGV[0] || abort('Usage: verify.rb <card-string>')
uri = URI('https://www.marketnow.site/api/trust?action=verify')
req = Net::HTTP::Post.new(uri, 'Content-Type' => 'application/json')
req.body = { card: card }.to_json

resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }
result = JSON.parse(resp.body)
puts "Decision:   #{result['decision']}"
puts "Format:     #{result['detected_format']}"
puts "Issuer:     #{result['issuer']}"
exit case result['decision']
     when 'PERMIT' then 0
     when 'DENY' then 1
     else 2
     end
"""),
    ("php", "verify.php", """<?php
/**
 * UTA — PHP example: verify a credential via public HTTP API.
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 */
$card = $argv[1] ?? die("Usage: php verify.php <card-string>\\n");
$ch = curl_init('https://www.marketnow.site/api/trust?action=verify');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode(['card' => $card]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
]);
$response = curl_exec($ch);
curl_close($ch);
$result = json_decode($response, true);
echo "Decision:   {$result['decision']}\\n";
echo "Format:     {$result['detected_format']}\\n";
echo "Issuer:     {$result['issuer']}\\n";
exit(match($result['decision']) {
    'PERMIT' => 0, 'DENY' => 1, default => 2,
});
"""),
    ("java", "Verify.java", """// UTA — Java example: verify a credential via public HTTP API (JDK 11+).
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class Verify {
    public static void main(String[] args) throws Exception {
        if (args.length < 1) { System.err.println("Usage: java Verify <card>"); System.exit(1); }
        String card = args[0];
        String payload = String.format("{\\"card\\":\\"%s\\"}", card);
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("https://www.marketnow.site/api/trust?action=verify"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(payload))
            .build();
        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
        System.out.println(resp.body());
    }
}
"""),
    ("csharp", "Program.cs", """// UTA — C# example: verify a credential via public HTTP API (.NET 8).
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
using System.Text;
using System.Text.Json;

var card = args.Length > 0 ? args[0] : throw new ArgumentException("Usage: verify <card>");
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
"""),
    ("elixir", "verify.exs", """# UTA — Elixir example: verify a credential via public HTTP API.
# Repo: https://github.com/alicelabs-llc/universal-trust-adapter
# Run: elixir verify.exs <card-string>
card = hd(System.argv())
payload = Jason.encode!(%{card: card})
response = HTTPoison.post!(
  "https://www.marketnow.site/api/trust?action=verify",
  payload,
  [{"Content-Type", "application/json"}],
  recv_timeout: 10_000
)
result = Jason.decode!(response.body)
IO.puts("Decision:   #{result["decision"]}")
IO.puts("Format:     #{result["detected_format"]}")
IO.puts("Issuer:     #{result["issuer"]}")
"""),
    ("swift", "verify.swift", """// UTA — Swift example: verify a credential via public HTTP API.
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
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
    }
    semaphore.signal()
}.resume()
semaphore.wait()
"""),
    ("kotlin", "Verify.kt", """// UTA — Kotlin example: verify a credential via public HTTP API (Ktor).
// Repo: https://github.com/alicelabs-llc/universal-trust-adapter
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

fun main(args: Array<String>) = runBlocking {
    val card = if (args.isNotEmpty()) args[0] else error("Usage: verify <card>")
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
"""),
    ("lua", "verify.lua", "-- UTA — Lua example: verify a credential via public HTTP API.\n-- Repo: https://github.com/alicelabs-llc/universal-trust-adapter\n\nlocal card = arg and arg[1] or error('Usage: lua verify.lua <card-string>')\nlocal http = require('socket.http')\nlocal ltn12 = require('ltn12')\nlocal json = require('dkjson')\n\nlocal payload = json.encode({ card = card })\nlocal response_body = {}\n\nlocal _, status = http.request{\n  url = 'https://www.marketnow.site/api/trust?action=verify',\n  method = 'POST',\n  headers = {\n    ['Content-Type'] = 'application/json',\n    ['Content-Length'] = #payload,\n  },\n  source = ltn12.source.string(payload),\n  sink = ltn12.sink.table(response_body),\n}\n\nlocal body = table.concat(response_body)\nlocal result = json.decode(body)\nprint('Decision:   ' .. (result.decision or '?'))\nprint('Format:     ' .. (result.detected_format or '?'))\nprint('Issuer:     ' .. (result.issuer or '?'))\n"),
    ("deno", "verify.ts", """/**
 * UTA — Deno example: verify a credential using native fetch (zero deps).
 * Repo: https://github.com/alicelabs-llc/universal-trust-adapter
 * Run:  deno run --allow-net verify.ts <card-string>
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
if (result.failed_stage) console.log('Failed at: ', result.failed_stage);
Deno.exit(result.decision === 'PERMIT' ? 0 : result.decision === 'DENY' ? 1 : 2);
"""),
]


# Write all snippets into language subfolders
written = []
for lang, filename, content in SNIPPETS:
    lang_dir = os.path.join(SNIPPETS_DIR, lang)
    os.makedirs(lang_dir, exist_ok=True)
    path = os.path.join(lang_dir, filename)
    with open(path, "w") as f:
        f.write(content)
    written.append({"lang": lang, "file": filename, "path": path})
    print(f"  ✅ {lang}/{filename}")

# Create README.md for the snippets folder
readme = """# UTA Code Snippets

Self-contained examples showing how to verify AI agent credentials via the
[Universal Trust Adapter (UTA)](https://github.com/alicelabs-llc/universal-trust-adapter)
in 15+ programming languages.

## Languages

| Language | File | Run command |
|----------|------|-------------|
| Node.js | `nodejs/verify-credential.mjs` | `node verify-credential.mjs` |
| Python | `python/verify_mcp_card.py` | `python3 verify_mcp_card.py` |
| Bash | `bash/verify.sh` | `./verify.sh <card>` |
| Rust | `rust/main.rs` | `cargo run -- <card>` |
| Go | `go/main.go` | `go run main.go <card>` |
| Ruby | `ruby/verify.rb` | `ruby verify.rb <card>` |
| PHP | `php/verify.php` | `php verify.php <card>` |
| Java | `java/Verify.java` | `java Verify <card>` |
| C# | `csharp/Program.cs` | `dotnet run -- <card>` |
| Elixir | `elixir/verify.exs` | `elixir verify.exs <card>` |
| Swift | `swift/verify.swift` | `swift verify.swift <card>` |
| Kotlin | `kotlin/Verify.kt` | `kotlinc Verify.kt -include-runtime -d verify.jar && java -jar verify.jar <card>` |
| Lua | `lua/verify.lua` | `lua verify.lua <card>` |
| Deno | `deno/verify.ts` | `deno run --allow-net verify.ts <card>` |

## All examples use the public API

```bash
curl -X POST https://www.marketnow.site/api/trust?action=verify \\
  -H "Content-Type: application/json" \\
  -d '{"card": "<your-credential>"}'
```

## What UTA verifies

UTA supports **8 credential formats**:

1. ATC v3 (Agent Trust Card)
2. JWT (with `x5c` chain)
3. W3C Verifiable Credentials
4. A2A (Agent-to-Agent) cards
5. EAT-AI (Entity Attestation Tokens)
6. ZTA (Zero Trust Agent) cards
7. MCP Server Cards
8. X.509 certificates

Each credential goes through a **12-stage pipeline**:
`PARSER → DETECT → SCHEMA → CRYPTO → ISSUER → KEY_BINDING → POP → PROVENANCE → LIFECYCLE → EVIDENCE → POLICY → DECISION`

## Links

- Repo: https://github.com/alicelabs-llc/universal-trust-adapter
- API: https://www.marketnow.site/api/trust
- NPM: `@marketnow/trust-core`
"""
with open(os.path.join(SNIPPETS_DIR, "README.md"), "w") as f:
    f.write(readme)
print(f"\n  ✅ README.md")

print(f"\n=== SUMMARY ===")
print(f"  Snippets written: {len(written)}")
print(f"  Languages: {sorted(set(s['lang'] for s in written))}")
print(f"  Location: {SNIPPETS_DIR}")
