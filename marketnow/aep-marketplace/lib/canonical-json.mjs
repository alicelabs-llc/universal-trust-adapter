/**
 * MarketNow — RFC 8785 Canonical JSON Implementation
 * ===================================================
 *
 * Implements JSON Canonicalization Scheme (JCS) per RFC 8785.
 * This replaces our ad-hoc recursive sort with a proper standard.
 *
 * Why: @anp2network on dev.to reported that our canonicalization
 * had a coverage bug (top-level only sorting). We fixed it with
 * recursive sorting, but the gold standard is RFC 8785 which also
 * handles number serialization, string escaping, and UTF-16 key ordering.
 *
 * Reference: https://tools.ietf.org/html/rfc8785
 */

import crypto from 'crypto';

export function canonicalize(value) {
  if (value === null || value === undefined) return 'null';
  const type = typeof value;
  if (type === 'boolean') return value ? 'true' : 'false';
  if (type === 'number') return serializeNumber(value);
  if (type === 'string') return serializeString(value);
  if (type === 'bigint') return value.toString();
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  if (type === 'object') return serializeObject(value);
  return serializeString(String(value));
}

function serializeNumber(num) {
  if (!Number.isFinite(num)) return 'null';
  if (Number.isInteger(num)) return num.toString();
  let str = num.toString();
  if (str.includes('e') || str.includes('E')) {
    str = str.replace(/E/g, 'e').replace(/e\+/, 'e');
  }
  if (str.includes('.') && !str.includes('e')) {
    str = str.replace(/\.?0+$/, '');
  }
  return str;
}

function serializeString(str) {
  let result = '"';
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch === 0x22) result += '\\"';
    else if (ch === 0x5c) result += '\\\\';
    // RFC 8785 §3.2.2.2: forward slash (0x2f) MUST NOT be escaped.
    // Previous code had `else if (ch === 0x2f) result += '\\/';` which was wrong.
    // Fix reported by @anp2network (Aug 13, 2026).
    else if (ch === 0x08) result += '\\b';
    else if (ch === 0x09) result += '\\t';
    else if (ch === 0x0a) result += '\\n';
    else if (ch === 0x0c) result += '\\f';
    else if (ch === 0x0d) result += '\\r';
    else if (ch < 0x20) result += '\\u' + ch.toString(16).padStart(4, '0');
    else result += str[i];
  }
  return result + '"';
}

function serializeObject(obj) {
  const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort(compareUtf16);
  if (keys.length === 0) return '{}';
  let result = '{';
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) result += ',';
    result += serializeString(keys[i]) + ':' + canonicalize(obj[keys[i]]);
  }
  return result + '}';
}

function compareUtf16(a, b) {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ca = a.charCodeAt(i);
    const cb = b.charCodeAt(i);
    if (ca < cb) return -1;
    if (ca > cb) return 1;
  }
  return a.length - b.length;
}

export function canonicalHash(value) {
  return crypto.createHash('sha256').update(canonicalize(value), 'utf-8').digest('hex');
}
