import os
#!/usr/bin/env python3
"""Batch submit 50 MCP servers to MarketNow + trigger L2 audits."""
import json
import urllib.request
import time
import sys

# 50 popular MCP servers from GitHub (curated list)
SERVERS = [
    # Tier 1: >10k stars
    "https://github.com/n8n-io/n8n",
    "https://github.com/google-gemini/gemini-cli",
    "https://github.com/koala73/worldmonitor",
    "https://github.com/D4Vinci/Scrapling",
    "https://github.com/ruvnet/ruflo",
    "https://github.com/sansan0/TrendRadar",
    "https://github.com/upstash/context7",
    "https://github.com/ChromeDevTools/chrome-devtools-mcp",
    "https://github.com/bytedance/UI-TARS-desktop",
    "https://github.com/DeusData/codebase-memory-mcp",
    # Tier 2: 1k-10k stars
    "https://github.com/modelcontextprotocol/servers",
    "https://github.com/modelcontextprotocol/python-sdk",
    "https://github.com/modelcontextprotocol/typescript-sdk",
    "https://github.com/modelcontextprotocol/inspector",
    "https://github.com/modelcontextprotocol/modelcontextprotocol",
    "https://github.com/anthropics/anthropic-quickstarts",
    "https://github.com/langchain-ai/langchain-mcp-adapters",
    "https://github.com/jlowin/fastmcp",
    "https://github.com/wong2/awesome-mcp-servers",
    "https://github.com/apappascs/mcp-servers-hub",
    "https://github.com/ravitemer/mcp-hub",
    # Tier 3: notable MCP servers
    "https://github.com/punkpeye/awesome-mcp-servers",
    "https://github.com/punkpeye/awesome-mcp-clients",
    "https://github.com/punkpeye/awesome-mcp-devtools",
    "https://github.com/GeekMLguy/mcp-ai-agent",
    "https://github.com/OSuron/mcp-server-nl2sql",
    "https://github.com/Codium-ai/cover-agent",
    "https://github.com/OutputThought/lab",
    "https://github.com/sirmalloc/ayrshare-servers",
    "https://github.com/stackloktoolchain/agentkit",
    "https://github.com/ably/ably-sdk-mcp",
    "https://github.com/ai-to-ai/mcp-shrimp-task-manager",
    "https://github.com/appcyzer/Yet-Another-AGENTS-MCP",
    "https://github.com/bhawna-R/mcp-cli-llm",
    "https://github.com/davido7/mcp-pdf-tool",
    "https://github.com/doteyeso-ops/mcp-server-vibes-coded",
    "https://github.com/edenayo/eden-ai-mcp-server",
    "https://github.com/fforres/autonomics-mcp",
    "https://github.com/felores/MyMCP",
    "https://github.com/gianluca-mascolo/mcp-remote-control",
    "https://github.com/helt/mcp-protocol-rs",
    "https://github.com/huggingface/huggingface-mcp-server",
    "https://github.com/ibm-watson-ai/assistant-toolkit",
    "https://github.com/last9/last9-mcp",
    "https://github.com/mongodb-developer/mcp-server-mongodb",
    "https://github.com/openai/openai-cookbook",
    "https://github.com/ramon-vilar/airtable-mcp-server",
    "https://github.com/supabase/mcp-server-supabase",
    "https://github.com/tavily-ai/tavily-mcp",
    "https://github.com/zilliztech/milvus-mcp-server",
    "https://github.com/zenml-io/mcp-server",
]

GH_TOKEN = os.environ.get("MANDATES_GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
REPO = "edgarfloresguerra2011-a11y/marketnow"
dispatch_url = f"https://api.github.com/repos/{REPO}/dispatches"

submitted = []
skipped = []
failed = []

for i, repo_url in enumerate(SERVERS):
    # Submit
    payload = json.dumps({
        "repo_url": repo_url,
        "submitter_agent_id": "agent_marketnow_batch",
        "submitter_email": "edison@alicelabs.site"
    }).encode()
    
    req = urllib.request.Request(
        "https://marketnow.site/api/submit-skill",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    try:
        r = urllib.request.urlopen(req, timeout=30)
        result = json.loads(r.read())
        skill_id = result.get("skill_id", "n/a")
        sub_id = result.get("submission_id", "n/a")
        status = result.get("status", result.get("error", "n/a"))
        
        if status == "submitted":
            submitted.append((skill_id, repo_url, sub_id))
            print(f"[{i+1:2}/50] OK {repo_url}")
            print(f"         skill_id={skill_id}")
            
            # Trigger L2 audit
            l2_payload = json.dumps({
                "event_type": "sentinel-l2-audit",
                "client_payload": {"skill_id": skill_id, "repo_url": repo_url}
            }).encode()
            l2_req = urllib.request.Request(
                dispatch_url, data=l2_payload,
                headers={
                    "Authorization": f"Bearer {GH_TOKEN}",
                    "Accept": "application/vnd.github+json",
                    "Content-Type": "application/json",
                    "User-Agent": "marketnow-batch"
                },
                method="POST"
            )
            try:
                urllib.request.urlopen(l2_req, timeout=10)
                print(f"         L2 triggered")
            except Exception as e:
                print(f"         L2 trigger FAILED: {e}")
        else:
            skipped.append(repo_url)
            print(f"[{i+1:2}/50] SKIP {repo_url} ({status})")
    except Exception as e:
        failed.append(repo_url)
        print(f"[{i+1:2}/50] FAIL {repo_url}: {e}")
    
    time.sleep(1.5)  # rate limit safety

print(f"\n=== SUMMARY ===")
print(f"Submitted: {len(submitted)}")
print(f"Skipped:   {len(skipped)}")
print(f"Failed:    {len(failed)}")
print(f"Total:     {len(SERVERS)}")
print(f"\nSkill IDs to promote later:")
for skill_id, repo_url, sub_id in submitted:
    print(f"  {skill_id} | {repo_url.split('/')[-1]}")
