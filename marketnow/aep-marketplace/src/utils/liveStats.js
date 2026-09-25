// MarketNow — single source of truth for public-facing numbers.
// The homepage must NEVER hardcode catalog/L2/version figures.
// Everything rendered here comes from /api/stats.json (the same API that
// certification.json and agent.json point to), with a build-time fallback
// that is itself sourced from the same stats payload.
//
// Architecture (fixes audit finding "homepage vs API drift"):
//   database / canonical stats  ->  /api/stats.json  ->  this module  ->  UI
import { useEffect, useState } from 'react';

// Fallback values = last-known values of /api/stats.json (v2.1.0, 2026-09-25).
// Only used while the fetch is in flight or if the API is unreachable.
export const FALLBACK_STATS = {
  total: 68388,          // discovery.total_mcp_servers
  tracked: 132737,       // discovery.total_tracked_all_sources
  l1: 68388,             // security.l1_index_certified
  l1Checks: 10,          // security.l1_checks
  l2: 2839,              // security.l2_sentinel_scanned
  l2Targets: 2868,       // security.l2_targets
  l2Pct: 99,             // security.l2_completion_pct
  clean: 885,            // security.l2_clean
  warn: 791,             // security.l2_flagged_warning
  err: 1156,             // security.l2_flagged_error
  scanErrs: 29,          // security.l2_scan_errors
  ownPackages: 13,       // security.l2_own_packages
  ownVulns: 0,           // security.npm_vulnerabilities_own_packages
  mcpTools: 15,          // tools.mcp_server_tools_count
  mcpVersion: '1.14.1',  // tools.mcp_server_version
  atcSdkVersion: '1.4.1',// tools.atc_sdk_version
  sentinelVersion: 'v3.0',
  adapters: 9,
  adapterList: ['ATC', 'EAT-AI', 'ZTA', 'A2A', 'MCP-Card', 'W3C-VC', 'OAuth', 'SPIFFE', 'X.509'],
  uts: 'UTS v2.0.0',
  generatedAt: '2026-09-25',
  npmDownloads: null,    // live from registry.npmjs.org, null until known
};

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function mapStats(d) {
  const disc = d?.discovery || {};
  const sec = d?.security || {};
  const tools = d?.tools || {};
  const fmt = d?.formats || {};
  return {
    total: num(disc.total_mcp_servers, FALLBACK_STATS.total),
    tracked: num(disc.total_tracked_all_sources, FALLBACK_STATS.tracked),
    l1: num(sec.l1_index_certified, FALLBACK_STATS.l1),
    l1Checks: num(sec.l1_checks, FALLBACK_STATS.l1Checks),
    l2: num(sec.l2_sentinel_scanned, FALLBACK_STATS.l2),
    l2Targets: num(sec.l2_targets, FALLBACK_STATS.l2Targets),
    l2Pct: num(sec.l2_completion_pct, FALLBACK_STATS.l2Pct),
    clean: num(sec.l2_clean, FALLBACK_STATS.clean),
    warn: num(sec.l2_flagged_warning, FALLBACK_STATS.warn),
    err: num(sec.l2_flagged_error, FALLBACK_STATS.err),
    scanErrs: num(sec.l2_scan_errors, FALLBACK_STATS.scanErrs),
    ownPackages: num(sec.l2_own_packages, FALLBACK_STATS.ownPackages),
    ownVulns: num(sec.npm_vulnerabilities_own_packages, FALLBACK_STATS.ownVulns),
    mcpTools: num(tools.mcp_server_tools_count, FALLBACK_STATS.mcpTools),
    mcpVersion: tools.mcp_server_version || FALLBACK_STATS.mcpVersion,
    atcSdkVersion: tools.atc_sdk_version || FALLBACK_STATS.atcSdkVersion,
    sentinelVersion: sec.sentinel_version || FALLBACK_STATS.sentinelVersion,
    adapters: num(fmt.count, FALLBACK_STATS.adapters),
    adapterList: Array.isArray(fmt.supported) && fmt.supported.length
      ? fmt.supported
      : FALLBACK_STATS.adapterList,
    uts: fmt.canonical_schema || FALLBACK_STATS.uts,
    generatedAt: d?.generated_at || FALLBACK_STATS.generatedAt,
    npmDownloads: null,
  };
}

// Module-level singleton: every component shares one fetch per page load.
let statsPromise = null;
export function fetchLiveStats() {
  if (!statsPromise) {
    statsPromise = fetch('/api/stats.json', { headers: { accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(d => (d ? mapStats(d) : null));
  }
  return statsPromise;
}

// npm registry downloads for the MCP package (registry API allows CORS).
let npmPromise = null;
export function fetchNpmDownloads() {
  if (!npmPromise) {
    npmPromise = fetch('https://api.npmjs.org/downloads/point/last-month/marketnow-mcp')
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(d => (d && typeof d.downloads === 'number' ? d.downloads : null));
  }
  return npmPromise;
}

export function useLiveStats() {
  const [stats, setStats] = useState(FALLBACK_STATS);
  useEffect(() => {
    let alive = true;
    fetchLiveStats().then(s => { if (s && alive) setStats(prev => ({ ...prev, ...s })); });
    fetchNpmDownloads().then(n => {
      if (typeof n === 'number' && alive) setStats(prev => ({ ...prev, npmDownloads: n }));
    });
    return () => { alive = false; };
  }, []);
  return stats;
}

// Convenience for i18n share text — interpolates the same live numbers.
export function statNumbers(s = FALLBACK_STATS) {
  return {
    total: s.total.toLocaleString('en-US'),
    l1: s.l1.toLocaleString('en-US'),
    l2: s.l2.toLocaleString('en-US'),
    l2Targets: s.l2Targets.toLocaleString('en-US'),
    flagged: (s.warn + s.err).toLocaleString('en-US'),
    mcpVersion: s.mcpVersion,
  };
}
