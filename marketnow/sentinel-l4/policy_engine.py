#!/usr/bin/env python3
"""
MarketNow Sentinel L4 — Policy Engine (Userspace)
==================================================

Receives events from eBPF programs and applies L4 policies.
Runs in userspace, reads from BPF ring buffers.

Q4 2026 — Prototype
"""

import json
import time
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional

class AlertLevel(Enum):
    INFO = "info"
    WARN = "warn"
    HIGH = "high"
    CRITICAL = "critical"

class ActionType(Enum):
    LOG = "log"
    ALERT = "alert"
    BLOCK = "block"
    REVOKE_ATC = "revoke_atc"

@dataclass
class L4Alert:
    level: AlertLevel
    category: str
    message: str
    pid: int = 0
    timestamp: str = ""
    action: ActionType = ActionType.LOG
    details: dict = field(default_factory=dict)

class L4PolicyEngine:
    """Applies L4 policies to events from eBPF."""
    
    # Sensitive paths that trigger CRITICAL alerts
    SENSITIVE_PATHS = [
        "~/.ssh/",
        "~/.aws/",
        "~/.config/",
        "~/.gnupg/",
        "/etc/",
        "/root/",
        "/var/log/",
        "~/.bashrc",
        "~/.zshrc",
        "~/.profile",
    ]
    
    def __init__(self, baseline: dict):
        self.baseline = baseline
        self.alerts: list[L4Alert] = []
        self.blocked_count = 0
        self.revoked = False
    
    def on_network_connect(self, domain: str, port: int, pid: int) -> L4Alert:
        """Called when MCP server attempts a network connection."""
        allowlist = self.baseline.get("network_domains", [])
        
        if domain in allowlist:
            return L4Alert(
                level=AlertLevel.INFO,
                category="network",
                message=f"Allowed connection to {domain}:{port}",
                pid=pid,
                action=ActionType.LOG,
            )
        
        # New domain not in baseline
        alert = L4Alert(
            level=AlertLevel.WARN,
            category="network_drift",
            message=f"New network connection to {domain}:{port} (not in L2 baseline)",
            pid=pid,
            action=ActionType.ALERT,
            details={"domain": domain, "port": port, "baseline_domains": allowlist},
        )
        self.alerts.append(alert)
        return alert
    
    def on_file_write(self, path: str, pid: int) -> L4Alert:
        """Called when MCP server writes to a file."""
        # Check if path is sensitive
        for sensitive in self.SENSITIVE_PATHS:
            if path.startswith(sensitive) or path == sensitive:
                alert = L4Alert(
                    level=AlertLevel.CRITICAL,
                    category="sensitive_file_write",
                    message=f"CRITICAL: MCP server writing to sensitive path: {path}",
                    pid=pid,
                    action=ActionType.BLOCK,
                    details={"path": path, "sensitive_pattern": sensitive},
                )
                self.alerts.append(alert)
                self.blocked_count += 1
                self._revoke_atc()
                return alert
        
        # Normal file write outside sensitive paths
        return L4Alert(
            level=AlertLevel.INFO,
            category="file_write",
            message=f"File write: {path}",
            pid=pid,
            action=ActionType.LOG,
        )
    
    def on_process_spawn(self, binary: str, pid: int) -> L4Alert:
        """Called when MCP server spawns a new process."""
        allowlist = self.baseline.get("processes", [])
        
        if binary in allowlist:
            return L4Alert(
                level=AlertLevel.INFO,
                category="process",
                message=f"Allowed process: {binary}",
                pid=pid,
                action=ActionType.LOG,
            )
        
        # New process not in baseline
        alert = L4Alert(
            level=AlertLevel.CRITICAL,
            category="process_drift",
            message=f"CRITICAL: MCP server spawning unapproved process: {binary}",
            pid=pid,
            action=ActionType.BLOCK,
            details={"binary": binary, "baseline_processes": allowlist},
        )
        self.alerts.append(alert)
        self.blocked_count += 1
        return alert
    
    def on_credential_access(self, path: str, pid: int) -> L4Alert:
        """Called when MCP server reads a credential file."""
        alert = L4Alert(
            level=AlertLevel.CRITICAL,
            category="credential_access",
            message=f"CRITICAL: MCP server accessing credential file: {path}",
            pid=pid,
            action=ActionType.BLOCK,
            details={"path": path},
        )
        self.alerts.append(alert)
        self.blocked_count += 1
        self._revoke_atc()
        return alert
    
    def _revoke_atc(self):
        """Revoke the ATC for this skill."""
        if not self.revoked:
            self.revoked = True
            # In production: POST /api/atc {action: "revoke", card_id, reason: "L4 critical alert"}
            print(f"[L4] ATC REVOKED — critical security violation detected")
    
    def get_summary(self) -> dict:
        return {
            "total_alerts": len(self.alerts),
            "blocked": self.blocked_count,
            "revoked": self.revoked,
            "alerts_by_level": {
                level.value: sum(1 for a in self.alerts if a.level == level)
                for level in AlertLevel
            },
        }


# ─── Example usage ────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Load L2 baseline (captured at certification time)
    baseline = {
        "network_domains": ["registry.npmjs.org", "github.com"],
        "processes": ["node", "python3"],
    }
    
    engine = L4PolicyEngine(baseline)
    
    # Simulate events
    engine.on_network_connect("registry.npmjs.org", 443, 1234)  # OK
    engine.on_network_connect("evil.com", 4444, 1234)            # WARN
    engine.on_file_write("/tmp/output.txt", 1234)                # OK
    engine.on_file_write("/root/.ssh/authorized_keys", 1234)     # CRITICAL
    engine.on_process_spawn("node", 1234)                        # OK
    engine.on_process_spawn("curl", 1234)                        # CRITICAL
    
    print(json.dumps(engine.get_summary(), indent=2))
