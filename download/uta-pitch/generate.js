const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "AliceLabs LLC";
pres.title = "UTA — Universal Trust Adapter";

const C = {
  bg: "0F1117", surface: "1A1D27", border: "2A2D3A",
  text: "E4E6EB", dim: "8B8E98", accent: "3B82F6",
  green: "22C55E", red: "EF4444", yellow: "EAB308",
};
const F = { heading: "Cambria", body: "Calibri", mono: "Consolas" };

// S1 Cover
let s1 = pres.addSlide();
s1.background = { color: C.bg };
s1.addText("UTA", { x: 0.5, y: 1.5, w: 9, h: 1.5, fontSize: 54, fontFace: F.heading, color: C.accent, bold: true });
s1.addText("Universal Trust Adapter", { x: 0.5, y: 2.6, w: 9, h: 0.6, fontSize: 24, fontFace: F.body, color: C.text });
s1.addText("The USB-C of Agent Trust", { x: 0.5, y: 3.2, w: 9, h: 0.5, fontSize: 18, fontFace: F.body, color: C.dim, italic: true });
s1.addText("AliceLabs LLC · 2026", { x: 0.5, y: 4.5, w: 9, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim });

// S2 Problem
let s2 = pres.addSlide();
s2.background = { color: C.bg };
s2.addText("El Problema", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
s2.addText("Los agentes AI no tienen forma estándar de verificar confianza", { x: 0.5, y: 1.2, w: 9, h: 0.5, fontSize: 16, fontFace: F.body, color: C.dim, italic: true });
const probs = [
  { title: "Credenciales Robadas", desc: "Un agente puede robar el JSON de otro y hacerse pasar por él. Sin criptografía, no hay identidad verificable.", icon: "🔴" },
  { title: "Suplantación de Issuer", desc: "Cualquiera puede emitir credenciales falsas. Sin verificación de CA, un atacante puede crear 'certificados' arbitrarios.", icon: "🟡" },
  { title: "Supply Chain Attacks", desc: "Sin binding criptográfico entre código fuente y credenciales, un agente malicioso puede inyectar código sin ser detectado.", icon: "🔴" },
];
probs.forEach((p, i) => {
  const y = 2.0 + i * 1.1;
  s2.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9, h: 0.95, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.08 });
  s2.addText(p.icon, { x: 0.7, y: y + 0.15, w: 0.5, h: 0.6, fontSize: 20 });
  s2.addText(p.title, { x: 1.3, y: y + 0.1, w: 3, h: 0.35, fontSize: 14, fontFace: F.body, color: C.text, bold: true });
  s2.addText(p.desc, { x: 1.3, y: y + 0.4, w: 7.8, h: 0.5, fontSize: 11, fontFace: F.body, color: C.dim, fit: "shrink" });
});

// S3 Solution
let s3 = pres.addSlide();
s3.background = { color: C.bg };
s3.addText("La Solución: UTA", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
s3.addText("Una capa de confianza universal para el ecosistema de agentes AI", { x: 0.5, y: 1.2, w: 9, h: 0.5, fontSize: 16, fontFace: F.body, color: C.dim, italic: true });
s3.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 2.0, w: 9, h: 3.0, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.1 });
s3.addText("Agent", { x: 1.0, y: 2.3, w: 2.5, h: 0.5, fontSize: 16, fontFace: F.body, color: C.accent, bold: true, align: "center" });
s3.addText("→", { x: 3.2, y: 2.3, w: 0.5, h: 0.5, fontSize: 20, color: C.dim, align: "center" });
s3.addText("UTA Trust Gateway", { x: 3.8, y: 2.3, w: 3, h: 0.5, fontSize: 16, fontFace: F.body, color: C.green, bold: true, align: "center" });
s3.addText("→", { x: 6.5, y: 2.3, w: 0.5, h: 0.5, fontSize: 20, color: C.dim, align: "center" });
s3.addText("Trust Decision", { x: 7.0, y: 2.3, w: 2.5, h: 0.5, fontSize: 16, fontFace: F.body, color: C.yellow, bold: true, align: "center" });
s3.addText("12-Stage Pipeline", { x: 1.0, y: 3.2, w: 2.5, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, align: "center" });
s3.addText("8 Adapters", { x: 3.8, y: 3.2, w: 3, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, align: "center" });
s3.addText("ALLOW / DENY", { x: 7.0, y: 3.2, w: 2.5, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, align: "center" });
s3.addText("Fail-closed: UNKNOWN = DENY · ERROR = DENY · EXPIRED = DENY · REVOKED = DENY", { x: 0.8, y: 4.0, w: 8.4, h: 0.5, fontSize: 12, fontFace: F.mono, color: C.red, align: "center" });

// S4 Pipeline
let s4 = pres.addSlide();
s4.background = { color: C.bg };
s4.addText("Pipeline de 12 Etapas", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const stages = ["01 PARSE", "02 DETECT", "03 SCHEMA", "04 CRYPTO", "05 ISSUER", "06 KEY_BIND", "07 POP", "08 PROVENANCE", "09 LIFECYCLE", "10 EVIDENCE", "11 POLICY", "12 DECISION"];
stages.forEach((stage, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 0.5 + col * 2.35;
  const y = 1.6 + row * 1.15;
  const isLast = i === 11;
  s4.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w: 2.1, h: 0.9,
    fill: { color: isLast ? C.green : C.surface },
    line: { color: isLast ? C.green : C.border, width: 1 },
    rectRadius: 0.06,
  });
  s4.addText(stage, { x, y: y + 0.15, w: 2.1, h: 0.6, fontSize: 11, fontFace: F.mono, color: isLast ? "FFFFFF" : C.text, align: "center", valign: "middle", bold: isLast });
});
s4.addText("Cada etapa es fail-closed. Cualquier fallo = DENY inmediato.", { x: 0.5, y: 5.0, w: 9, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, italic: true, align: "center" });

// S5 Metrics
let s5 = pres.addSlide();
s5.background = { color: C.bg };
s5.addText("Métricas Clave", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const metrics = [
  { value: "480+", label: "Tests Passing", color: C.green },
  { value: "6,744", label: "Verifications/sec", color: C.accent },
  { value: "20+", label: "npm Packages", color: C.yellow },
  { value: "4", label: "Language SDKs", color: C.text },
];
metrics.forEach((m, i) => {
  const x = 0.5 + i * 2.35;
  s5.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.8, w: 2.1, h: 2.5, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.1 });
  s5.addText(m.value, { x, y: 2.1, w: 2.1, h: 1.2, fontSize: 40, fontFace: F.heading, color: m.color, bold: true, align: "center", valign: "middle" });
  s5.addText(m.label, { x, y: 3.3, w: 2.1, h: 0.6, fontSize: 13, fontFace: F.body, color: C.dim, align: "center" });
});
s5.addText("TS · Python · Rust · Go — todos verifican los mismos 36 test vectors", { x: 0.5, y: 4.6, w: 9, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, italic: true, align: "center" });

// S6 Adapters
let s6 = pres.addSlide();
s6.background = { color: C.bg };
s6.addText("Adapters Soportados", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const adapters = [
  ["ATC v3", "Ed25519", "✅ Stable"],
  ["JWT", "RS256 / ES256 / EdDSA", "✅ Stable"],
  ["W3C VC", "Ed25519Signature2020", "✅ Stable"],
  ["A2A", "Ed25519Signature2020", "✅ Stable"],
  ["EAT-AI", "EdDSA / ES256 / RS256", "✅ Beta"],
  ["ZTA", "Ed25519 + UTA-ZTA-CARD", "✅ Beta"],
  ["MCP", "Ed25519 + UTA-MCP-CARD", "✅ Stable"],
  ["X.509", "RSA / ECDSA / Ed25519", "✅ Stable"],
];
s6.addTable(
  [["Format", "Algorithm", "Status"], ...adapters],
  {
    x: 0.5, y: 1.6, w: 9, h: 3.5,
    fontSize: 12, fontFace: F.body, color: C.text,
    fill: { color: C.surface },
    border: { type: "solid", pt: 1, color: C.border },
    colW: [2.5, 3.5, 3],
    rowH: 0.4,
    headerRow: true,
    align: "left",
  }
);
// Override table header style
s6.addText("8 formatos · Auto-detección · Traducción cross-format", { x: 0.5, y: 5.2, w: 9, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, italic: true, align: "center" });

// S7 Crypto
let s7 = pres.addSlide();
s7.background = { color: C.bg };
s7.addText("Seguridad Criptográfica", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const cryptoFeatures = [
  { title: "Ed25519 (RFC 8032)", desc: "Firmas digitales de 64 bytes. Verificación en ~100μs. Sin dependencias externas — Node.js built-in." },
  { title: "JCS (RFC 8785)", desc: "Canonicalización determinista JSON. Mismo input → mismos bytes en cualquier lenguaje. SHA-256 reproducible." },
  { title: "7 Dominios de Separación", desc: "Una firma de ATC no verifica en dominio PoP. Previene reuso cross-contexto de firmas." },
  { title: "PoP con Nonce Anti-Replay", desc: "Challenge-response con nonce de 32 bytes. Single-use: segundo uso = error de replay." },
  { title: "Multi-firma N-of-M", desc: "Quórum configurable. Múltiples CAs pueden firmar el mismo credential. Política required_key_ids." },
  { title: "Post-Cuántico Ready", desc: "Abstracción ML-DSA-65 (FIPS 204). HybridSigner: Ed25519 + PQ en paralelo. Migración 2030-2035." },
];
cryptoFeatures.forEach((f, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.5 + col * 4.7;
  const y = 1.5 + row * 1.25;
  s7.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 4.3, h: 1.1, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.08 });
  s7.addText(f.title, { x: x + 0.2, y: y + 0.1, w: 3.9, h: 0.35, fontSize: 13, fontFace: F.body, color: C.accent, bold: true });
  s7.addText(f.desc, { x: x + 0.2, y: y + 0.4, w: 3.9, h: 0.65, fontSize: 10, fontFace: F.body, color: C.dim, fit: "shrink" });
});

// S8 Revocation
let s8 = pres.addSlide();
s8.background = { color: C.bg };
s8.addText("Revocación Triple", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const revMethods = [
  { title: "CRL", subtitle: "Certificate Revocation List", desc: "Lista firmada de credential IDs revocados. Cache con TTL. Verificación Ed25519 de la firma del CA.", color: C.accent },
  { title: "OCSP", subtitle: "Online Certificate Status", desc: "Responder HTTP en tiempo real. Nonce anti-replay. Respuesta firmada con Ed25519. Fail-closed en timeout.", color: C.green },
  { title: "Bitstring", subtitle: "W3C Status List 2021", desc: "Bitstring comprimido (gzip+base64url). 1 bit por credential. Escala a millones en ~30KB.", color: C.yellow },
];
revMethods.forEach((r, i) => {
  const x = 0.5 + i * 3.13;
  s8.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 2.85, h: 3.2, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.1 });
  s8.addText(r.title, { x, y: 1.8, w: 2.85, h: 0.5, fontSize: 22, fontFace: F.heading, color: r.color, bold: true, align: "center" });
  s8.addText(r.subtitle, { x, y: 2.3, w: 2.85, h: 0.4, fontSize: 11, fontFace: F.body, color: C.dim, align: "center", italic: true });
  s8.addText(r.desc, { x: x + 0.2, y: 2.8, w: 2.45, h: 1.8, fontSize: 11, fontFace: F.body, color: C.text, fit: "shrink" });
});

// S9 Supply Chain
let s9 = pres.addSlide();
s9.background = { color: C.bg };
s9.addText("Supply Chain Hardening", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
s9.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.6, w: 9, h: 2.5, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.1 });
const chain = ["Git SHA", "npm SHA-256", "SBOM Hash", "SLSA Provenance", "Sigstore Sig", "ATC Credential"];
chain.forEach((step, i) => {
  const x = 0.8 + i * 1.48;
  s9.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.2, w: 1.3, h: 0.6, fill: { color: C.accent, transparency: 70 + i * 5 }, line: { color: C.accent, width: 1 }, rectRadius: 0.06 });
  s9.addText(step, { x, y: 2.25, w: 1.3, h: 0.5, fontSize: 10, fontFace: F.body, color: C.text, align: "center", valign: "middle", bold: true });
  if (i < chain.length - 1) {
    s9.addText("→", { x: x + 1.25, y: 2.25, w: 0.3, h: 0.5, fontSize: 14, color: C.dim, align: "center", valign: "middle" });
  }
});
s9.addText("Cadena criptográfica: cada paso verifica el anterior", { x: 0.8, y: 3.1, w: 8.4, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, italic: true, align: "center" });
const scFeatures = ["SBOM (SPDX 2.3) por paquete", "SLSA Build Level 3", "Sigstore keyless (Fulcio + Rekor)", "npm publish --provenance"];
scFeatures.forEach((f, i) => {
  const x = 0.5 + (i % 2) * 4.7;
  const y = 4.3 + Math.floor(i / 2) * 0.5;
  s9.addText("✅ " + f, { x, y, w: 4.3, h: 0.4, fontSize: 12, fontFace: F.body, color: C.green });
});

// S10 Deployment
let s10 = pres.addSlide();
s10.background = { color: C.bg };
s10.addText("Deployment Ready", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const deployOpts = [
  { value: "Docker", label: "Multi-stage build\nNode 20 slim\nNon-root user", color: C.accent },
  { value: "K8s", label: "Helm chart\nHPA 2-10 replicas\nHealth checks", color: C.green },
  { value: "CI/CD", label: "GitHub Actions\nSigstore + SLSA\nAuto-release", color: C.yellow },
  { value: "CLI", label: "uta-verify\n7 formatos\nAuto-detect", color: C.text },
];
deployOpts.forEach((d, i) => {
  const x = 0.5 + i * 2.35;
  s10.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: 2.1, h: 3.0, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.1 });
  s10.addText(d.value, { x, y: 1.8, w: 2.1, h: 0.6, fontSize: 20, fontFace: F.heading, color: d.color, bold: true, align: "center" });
  s10.addText(d.label, { x: x + 0.15, y: 2.5, w: 1.8, h: 1.8, fontSize: 12, fontFace: F.body, color: C.dim, align: "center", valign: "top" });
});

// S11 Compliance
let s11 = pres.addSlide();
s11.background = { color: C.bg };
s11.addText("Compliance", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const compliance = [
  ["SOC 2", "11 Trust Services Criteria", "API key auth, PoP, rate limiting, audit log, key rotation"],
  ["ISO 27001", "13 Annex A Controls", "Crypto controls, key management, event logging, secure dev"],
  ["NIST CSF", "5 Functions", "Identify (SBOM), Protect (PoP), Detect (audit), Respond (revocation), Recover (rotation)"],
];
compliance.forEach((c, i) => {
  const y = 1.5 + i * 1.25;
  s11.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y, w: 9, h: 1.1, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.08 });
  s11.addText(c[0], { x: 0.7, y: y + 0.1, w: 1.8, h: 0.4, fontSize: 16, fontFace: F.heading, color: C.accent, bold: true });
  s11.addText(c[1], { x: 2.6, y: y + 0.1, w: 3, h: 0.4, fontSize: 13, fontFace: F.body, color: C.text, bold: true });
  s11.addText(c[2], { x: 2.6, y: y + 0.45, w: 6.5, h: 0.5, fontSize: 11, fontFace: F.body, color: C.dim, fit: "shrink" });
});
s11.addText("Threat Model: STRIDE + MITRE ATLAS — 35 mitigaciones, 10 técnicas AI mitigadas", { x: 0.5, y: 5.0, w: 9, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, italic: true, align: "center" });

// S12 PQ Roadmap
let s12 = pres.addSlide();
s12.background = { color: C.bg };
s12.addText("Roadmap Post-Cuántico", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
const phases = [
  { year: "2026", title: "Classical Only", desc: "Ed25519 puro. ML-DSA-65 abstracción lista pero sin backend.", color: C.accent },
  { year: "2030", title: "Hybrid Required", desc: "Ed25519 + ML-DSA-65 en paralelo. Defense in depth. Ambas firmas requeridas.", color: C.yellow },
  { year: "2035", title: "PQ Only", desc: "Ed25519 deprecado. ML-DSA-65 único algoritmo. Quantum-safe.", color: C.green },
];
phases.forEach((p, i) => {
  const x = 0.5 + i * 3.13;
  s12.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.8, w: 2.85, h: 3.0, fill: { color: C.surface }, line: { color: p.color, width: 2 }, rectRadius: 0.1 });
  s12.addText(p.year, { x, y: 2.0, w: 2.85, h: 0.6, fontSize: 28, fontFace: F.heading, color: p.color, bold: true, align: "center" });
  s12.addText(p.title, { x, y: 2.6, w: 2.85, h: 0.4, fontSize: 14, fontFace: F.body, color: C.text, bold: true, align: "center" });
  s12.addText(p.desc, { x: x + 0.2, y: 3.1, w: 2.45, h: 1.5, fontSize: 11, fontFace: F.body, color: C.dim, fit: "shrink" });
});
s12.addText("HybridSigner: firma con Ed25519 + PQ simultáneamente — verificación requiere ambas", { x: 0.5, y: 5.0, w: 9, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, italic: true, align: "center" });

// S13 License
let s13 = pres.addSlide();
s13.background = { color: C.bg };
s13.addText("Modelo de Licencia", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true });
s13.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 1.0, y: 1.6, w: 8, h: 3.5, fill: { color: C.surface }, line: { color: C.border, width: 1 }, rectRadius: 0.1 });
s13.addText("AL-1.0", { x: 1.5, y: 1.8, w: 7, h: 0.6, fontSize: 28, fontFace: F.heading, color: C.accent, bold: true, align: "center" });
s13.addText("AliceLabs Source-Available License v1.0", { x: 1.5, y: 2.4, w: 7, h: 0.4, fontSize: 14, fontFace: F.body, color: C.dim, align: "center" });
const licPoints = [
  "✅ Source-available — todo el código es legible y auditable",
  "✅ Uso personal/educativo/libre sin restricciones",
  "⚠️ Uso comercial requiere licencia separada",
  "✅ Plugin template: MIT (ecosistema abierto para terceros)",
  "✅ Specs: CC-BY-NC-ND 4.0 (abiertas para lectura)",
];
licPoints.forEach((p, i) => {
  s13.addText(p, { x: 1.5, y: 3.0 + i * 0.4, w: 7, h: 0.35, fontSize: 13, fontFace: F.body, color: C.text });
});
s13.addText("Contacto: legal@alicelabs.site", { x: 1.5, y: 5.2, w: 7, h: 0.4, fontSize: 12, fontFace: F.body, color: C.dim, italic: true, align: "center" });

// S14 Team
let s14 = pres.addSlide();
s14.background = { color: C.bg };
s14.addText("Equipo AliceLabs", { x: 0.5, y: 1.5, w: 9, h: 0.8, fontSize: 36, fontFace: F.heading, color: C.text, bold: true, align: "center" });
s14.addText("Edison Flores & Alejandro Flores", { x: 0.5, y: 2.5, w: 9, h: 0.5, fontSize: 20, fontFace: F.body, color: C.accent, align: "center" });
s14.addText("AliceLabs LLC · Wyoming, USA", { x: 0.5, y: 3.0, w: 9, h: 0.4, fontSize: 16, fontFace: F.body, color: C.dim, align: "center" });
s14.addShape(pres.shapes.LINE, { x: 3.0, y: 3.7, w: 4, h: 0, line: { color: C.border, width: 1 } });
s14.addText("github.com/eddyflores100-lang/universal-trust-adapter", { x: 0.5, y: 4.0, w: 9, h: 0.4, fontSize: 14, fontFace: F.mono, color: C.accent, align: "center" });
s14.addText("info@alicelabs.site", { x: 0.5, y: 4.5, w: 9, h: 0.4, fontSize: 14, fontFace: F.body, color: C.dim, align: "center" });

pres.writeFile({ fileName: "/home/z/my-project/download/uta-pitch/UTA-Pitch-Facebook.pptx" }).then(() => {
  console.log("✅ PPTX generated");
});
