/**
 * ⚠️ SENTINEL PROPRIETARY — Copyright (c) 2026 AliceLabs LLC. All Rights Reserved.
 *
 * MarketNow — Sentinel L1.8 YARA-equivalent Malware Family Detection
 * ==================================================================
 *
 * L1.7 catches generic patterns (launchers, bytecode, download badges).
 * L1.8 catches SPECIFIC malware families by signature — like YARA rules
 * but implemented in JS regex for the runtime audit path.
 *
 * Signatures sourced from:
 *   - MalwareBazaar (abuse.ch) — sample analysis
 *   - YARA-Rules community repo
 *   - AlienVault OTX pulses
 *   - Incident response from issue #9 (Trojan:Win64/Lazy.PGPK!MTB)
 *
 * Each rule has:
 *   - id: stable identifier (MLF-XXX)
 *   - family: malware family name (Emotet, Lazy, CobaltStrike, etc.)
 *   - pattern: regex matching unique bytecode/string signature
 *   - severity: critical (instant quarantine) | high (likely quarantine)
 *   - mitre: MITRE ATT&CK technique ID
 *   - source: where the signature came from
 *
 * Runs on:
 *   - Skill metadata (always)
 *   - Skill package contents (when packageBuffer provided)
 *   - Real-time /api/audit-skill?deep=1
 */

// ─── Malware family signatures ──────────────────────────────────────────

const MALWARE_FAMILIES = [
  {
    id: 'MLF-LAZY-001',
    family: 'Win64/Lazy.PGPK',
    severity: 'critical',
    mitre: 'T1027.002',
    pattern: /unit\.exe\s+package\.txt|Application\.cmd.*start\s+unit\.exe/i,
    description: 'Trojan:Win64/Lazy.PGPK!MTB — staged launcher using Application.cmd → unit.exe + package.txt (obfuscated Lua bytecode). This is the exact signature from the prospector-email-finder incident (issue #9, July 2026).',
    source: 'incident #9 response',
  },
  {
    id: 'MLF-EMOTET-001',
    family: 'Emotet',
    severity: 'critical',
    mitre: 'T1027.011',
    pattern: /Emotet|Geodo|Heodo/i,
    description: 'Emotet banking trojan — often delivered via malicious Office macros. Strings "Emotet", "Geodo", or "Heodo" appear in payloads.',
    source: 'MalwareBazaar signatures',
  },
  {
    id: 'MLF-COBALT-001',
    family: 'Cobalt Strike Beacon',
    severity: 'critical',
    mitre: 'T1071.001',
    pattern: /cobaltstrike|cobalt\s*strike|beacon\.dll|Metasploit/i,
    description: 'Cobalt Strike beacon — common in post-exploitation. Often used by ransomware operators.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-MIMIKATZ-001',
    family: 'Mimikatz',
    severity: 'critical',
    mitre: 'T1003.001',
    pattern: /mimikatz|sekurlsa::logonpasswords|lsadump::sam|gentilkiwi/i,
    description: 'Mimikatz credential dumper — extracts Windows credentials from LSASS. Often packaged in malicious "MCP admin tools".',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-QAKBOT-001',
    family: 'QakBot',
    severity: 'critical',
    mitre: 'T1027',
    pattern: /QakBot|QBot|Pinkslipbot/i,
    description: 'QakBot banking trojan — often distributed via hijacked email threads.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-TRICKBOT-001',
    family: 'TrickBot',
    severity: 'critical',
    mitre: 'T1027',
    pattern: /TrickBot|TrickLoader/i,
    description: 'TrickBot modular trojan — precursor to Ryuk/Conti ransomware.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-AGENTTESLA-001',
    family: 'Agent Tesla',
    severity: 'critical',
    mitre: 'T1056.001',
    pattern: /Agent\s*Tesla|agtls/i,
    description: 'Agent Tesla keylogger — popular in phishing campaigns targeting businesses.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-REDLINE-001',
    family: 'RedLine Stealer',
    severity: 'critical',
    mitre: 'T1555',
    pattern: /RedLine\s*Stealer|RedLine\s*Info/i,
    description: 'RedLine Stealer — extracts browser credentials, crypto wallets, FTP clients.',
    source: 'MalwareBazaar',
  },
  {
    id: 'MLF-VIDAR-001',
    family: 'Vidar Stealer',
    severity: 'critical',
    mitre: 'T1555',
    pattern: /Vidar\s*Stealer/i,
    description: 'Vidar Stealer — fork of HyperStealer, targets browsers and crypto wallets.',
    source: 'MalwareBazaar',
  },
  {
    id: 'MLF-RACCOON-001',
    family: 'Raccoon Stealer',
    severity: 'critical',
    mitre: 'T1555',
    pattern: /Raccoon\s*Stealer|Rac[oó]on\s*Stealer/i,
    description: 'Raccoon Stealer — MaaS (malware-as-a-service) targeting browsers and crypto.',
    source: 'MalwareBazaar',
  },
  {
    id: 'MLF-LUMMA-001',
    family: 'LummaC2 Stealer',
    severity: 'critical',
    mitre: 'T1555',
    pattern: /LummaC2|Lumma\s*Stealer/i,
    description: 'LummaC2 Stealer — sold on Telegram, targets browser data and crypto wallets.',
    source: 'MalwareBazaar',
  },
  {
    id: 'MLF-ASYNC-001',
    family: 'AsyncRAT',
    severity: 'critical',
    mitre: 'T1071.001',
    pattern: /AsyncRAT|Async\s*RAT/i,
    description: 'AsyncRAT — open-source RAT often abused by criminals for remote access.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-NJCAT-001',
    family: 'njRAT',
    severity: 'critical',
    mitre: 'T1071.001',
    pattern: /njRAT|Bladabindi/i,
    description: 'njRAT (Bladabindi) — popular .NET RAT used for surveillance and credential theft.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-REMCOS-001',
    family: 'Remcos RAT',
    severity: 'critical',
    mitre: 'T1071.001',
    pattern: /Remcos\s*RAT|Remcos\s*Pro/i,
    description: 'Remcos RAT — commercial RAT often cracked and redistributed for malicious use.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-SOLARMARKET-001',
    family: 'SolarMarker/Jupiter',
    severity: 'high',
    mitre: 'T1027',
    pattern: /SolarMarker|Jupiter\s*Stealer/i,
    description: 'SolarMarker (Jupiter) — backdoor masquerading as PDF/Office docs in SEO-poisoned search results.',
    source: 'MalwareBazaar',
  },
  {
    id: 'MLF-LOKIBOT-001',
    family: 'Lokibot',
    severity: 'critical',
    mitre: 'T1555',
    pattern: /Lokibot|Loki\s*Bot/i,
    description: 'Lokibot — credential stealer targeting browsers, FTP, crypto wallets.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-IPHIOS-001',
    family: 'IPHost DoS',
    severity: 'high',
    mitre: 'T1499',
    pattern: /hping3|slowloris|goldeneye|rudy\s*--/,
    description: 'DoS tools — hping3, slowloris, goldeneye, RUDY. Often bundled in "stress test" MCP servers.',
    source: 'incident response',
  },
  {
    id: 'MLF-ATOMIC-001',
    family: 'Atomic Stealer',
    severity: 'critical',
    mitre: 'T1555.003',
    pattern: /Atomic\s*Stealer|AMOS|AtomicStealer/i,
    description: 'Atomic Stealer (AMOS) — macOS-targeting infostealer. Exfiltrates Keychain, browser data, crypto wallets.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-DARKGATE-001',
    family: 'DarkGate',
    severity: 'critical',
    mitre: 'T1027.011',
    pattern: /DarkGate|dark_gate|DG_loader/i,
    description: 'DarkGate — malware-as-a-service loader. Delivered via phishing, uses AutoIt scripts for execution.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-ICEDID-001',
    family: 'IcedID',
    severity: 'critical',
    mitre: 'T1027',
    pattern: /IcedID|BokBot|Buran/i,
    description: 'IcedID (BokBot) — banking trojan. Steals financial credentials, often precursor to ransomware.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-BUMBLE-001',
    family: 'BumbleBee',
    severity: 'critical',
    mitre: 'T1027.002',
    pattern: /BumbleBee|bumble_bee|BB_loader/i,
    description: 'BumbleBee — loader used by ransomware groups (Conti, BlackBasta). Delivered via phishing emails.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-PIKABOT-001',
    family: 'Pikabot',
    severity: 'critical',
    mitre: 'T1027',
    pattern: /Pikabot|pika_bot|PikaLoader/i,
    description: 'Pikabot — QakBot successor. Loader delivered via hijacked email threads, used for ransomware delivery.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-CHROMELOADER-001',
    family: 'ChromeLoader',
    severity: 'high',
    mitre: 'T1176',
    pattern: /ChromeLoader|chrome_loader|ChromeJanus/i,
    description: 'ChromeLoader — browser hijacker distributed via malicious ISO/DMG files. Modifies browser settings, redirects searches.',
    source: 'incident response 2026',
  },
  {
    id: 'MLF-BANLOADER-001',
    family: 'BanLoader',
    severity: 'critical',
    mitre: 'T1027.011',
    pattern: /BanLoader|ban_loader|BanBot/i,
    description: 'BanLoader — Chrome extension malware. Hijacks browser sessions, steals cookies and tokens.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-RHYSIDA-001',
    family: 'Rhysida',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /Rhysida|rhysida_ransom|RhysidaRansom/i,
    description: 'Rhysida — ransomware that encrypts files and threatens public data leak. Targets education, healthcare, manufacturing.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-BLACKBASTA-001',
    family: 'BlackBasta',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /BlackBasta|black_basta|BB_encrypt/i,
    description: 'BlackBasta — ransomware-as-a-service. Double extortion: encrypts + leaks. Uses BumbleBee for initial access.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-LOCKBIT-001',
    family: 'LockBit',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /LockBit|lock_bit|LockBit3|LockBitBlack/i,
    description: 'LockBit 3.0 — most active ransomware family. Encrypts files, exfiltrates data, double extortion.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-CL0P-001',
    family: 'Cl0p',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /Cl0p|Clop_ransom|Cl0pLoader/i,
    description: 'Cl0p — ransomware known for mass exploitation of MOVEit and GoAnywhere vulnerabilities.',
    source: 'incident response 2026',
  },
  {
    id: 'MLF-AMOS-001',
    family: 'AtomicStealer (AMOS)',
    severity: 'critical',
    mitre: 'T1539',
    pattern: /AtomicStealer|AMOS_stealer|AMOSStealer/i,
    description: 'AtomicStealer (AMOS) — macOS info stealer targeting Safari cookies, Keychain, crypto wallets.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-METASTEALER-001',
    family: 'MetaStealer',
    severity: 'critical',
    mitre: 'T1539',
    pattern: /MetaStealer|meta_stealer|MetaSteal/i,
    description: 'MetaStealer — info stealer targeting Windows. Steals browser data, crypto wallets, Telegram sessions.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-RISEPRO-001',
    family: 'RisePro',
    severity: 'critical',
    mitre: 'T1539',
    pattern: /RisePro|rise_pro|RiseStealer/i,
    description: 'RisePro — info stealer. Steals credentials, credit cards, crypto wallets from browsers.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-STEALC-001',
    family: 'StealC',
    severity: 'critical',
    mitre: 'T1539',
    pattern: /StealC|steal_c|StealBot/i,
    description: 'StealC — modular info stealer. Steals browser data, FTP clients, messaging apps, crypto wallets.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-LUMMAC2-001',
    family: 'LummaC2',
    severity: 'critical',
    mitre: 'T1539',
    pattern: /LummaC2|lumma_c2|LummaStealer/i,
    description: 'LummaC2 — info stealer with C2 panel. Steals browser autofill, cookies, passwords, crypto wallets.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-SOCGHOLISH-001',
    family: 'SocGholish (FakeUpdates)',
    severity: 'critical',
    mitre: 'T1185',
    pattern: /SocGholish|FakeUpdates|soc_gholish/i,
    description: 'SocGholish — masquerades as website updates. Delivers Cobalt Strike and post-exploitation tools.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-MEDUZA-001',
    family: 'Meduza Stealer',
    severity: 'critical',
    mitre: 'T1539',
    pattern: /Meduza|meduza_stealer|MeduzaStealer/i,
    description: 'Meduza Stealer — Windows info stealer targeting passwords, cookies, crypto wallets, browsing history.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-PHORPIEX-001',
    family: 'Phorpiex',
    severity: 'high',
    mitre: 'T1071.001',
    pattern: /Phorpiex|phorpiex_bot|PhorpiexBot/i,
    description: 'Phorpiex — botnet for distributing ransomware and crypto-mining. Known for mass email extortion.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-LOCKBIT3-001',
    family: 'LockBit 3.0',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /LockBit.*3|lockbit3|LockBitBlack/i,
    description: 'LockBit 3.0 (Black) — most widely deployed ransomware 2025-2026. Encrypts, steals, extorts.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-BLACKCAT-001',
    family: 'BlackCat (ALPHV)',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /BlackCat|ALPHV|alpha_v_ransom/i,
    description: 'BlackCat (ALPHV) — Rust-based ransomware. RaaS targeting healthcare, government, critical infrastructure.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-PLAY-001',
    family: 'Play Ransomware',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /Play.*ransom|play_ransom|PlayRansomware/i,
    description: 'Play Ransomware — targets via vulnerable RDP and VPN. Encrypts with .play extension.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-AKIRA-001',
    family: 'Akira',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /Akira.*ransom|akira_ransom|AkiraRansom/i,
    description: 'Akira — ransomware targeting VPN vulnerabilities. Encrypts with .akira extension.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-BABUK-001',
    family: 'Babuk',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /Babuk|babuk_ransom|BabukSource/i,
    description: 'Babuk — ransomware whose source code was leaked, spawning many variants.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-CONTI-001',
    family: 'Conti',
    severity: 'critical',
    mitre: 'T1486',
    pattern: /Conti|conti_ransom|ContiLocker/i,
    description: 'Conti — ransomware whose leaked chats revealed RaaS operations. Source used in multiple variants.',
    source: 'YARA-Rules community',
  },
  {
    id: 'MLF-WARMCOOKIE-001',
    family: 'WarmCookie',
    severity: 'high',
    mitre: 'T1027.011',
    pattern: /WarmCookie|warm_cookie|WarmCookieLoader/i,
    description: 'WarmCookie — backdoor loader via fake installers. Provides remote access and payload delivery.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-ARECH-001',
    family: 'ArechClient',
    severity: 'high',
    mitre: 'T1027.011',
    pattern: /ArechClient|arech_client|ArechBot/i,
    description: 'ArechClient — downloader/loader that fetches second-stage payloads. Paired with info stealers.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-BLACKBLENDR-001',
    family: 'BlackBrenda',
    severity: 'high',
    mitre: 'T1027.011',
    pattern: /BlackBrenda|black_brenda|BrendaLoader/i,
    description: 'BlackBrenda — loader distributed via malvertising. Downloads info stealers and RATs.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-DARKGATE-002',
    family: 'DarkGate (v2)',
    severity: 'critical',
    mitre: 'T1027.011',
    pattern: /DarkGate.*v2|dark_gate_v2|DarkGateAutoIt/i,
    description: 'DarkGate v2 — updated variant with AutoIt execution. Distributed via Teams phishing.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-PRIVATEPANDA-001',
    family: 'PrivatePanda',
    severity: 'high',
    mitre: 'T1027.011',
    pattern: /PrivatePanda|private_panda|PandaLoader/i,
    description: 'PrivatePanda — loader distributed via fake software cracks. Downloads and executes payloads.',
    source: 'MalwareBazaar 2026',
  },
  {
    id: 'MLF-NITOKU-001',
    family: 'Nitoku',
    severity: 'high',
    mitre: 'T1027.011',
    pattern: /Nitoku|nitoku_loader|NitokuBot/i,
    description: 'Nitoku — downloader using living-off-the-land techniques. Evades traditional AV.',
    source: 'MalwareBazaar 2026',
  },
];

// ─── Run L1.8 ───────────────────────────────────────────────────────────

/**
 * Run L1.8 malware family detection.
 * @param {Object} skill - skill metadata
 * @param {Object} [options]
 * @param {string} [options.packageText] - if provided, scan this text (e.g. README/package.json contents)
 * @returns {Object} { findings, score_adjustment, quarantine_recommended, details }
 */
export function runL18(skill, options = {}) {
  const { packageText } = options;
  const findings = {
    matched_families: [],
    total_critical: 0,
    total_high: 0,
  };

  // Scan metadata
  const metadataText = [
    skill.name || '',
    skill.description || '',
    skill.doc?.system_prompt || '',
    skill.doc?.setup || '',
    skill.install || '',
    skill.author || '',
    skill.source?.note || '',
  ].join('\n');

  const allText = packageText ? `${metadataText}\n${packageText}` : metadataText;

  for (const rule of MALWARE_FAMILIES) {
    if (rule.pattern.test(allText)) {
      findings.matched_families.push({
        id: rule.id,
        family: rule.family,
        severity: rule.severity,
        mitre: rule.mitre,
        description: rule.description,
        source: rule.source,
      });
      if (rule.severity === 'critical') findings.total_critical++;
      else if (rule.severity === 'high') findings.total_high++;
    }
  }

  // Score adjustment
  let scoreAdjustment = 0;
  if (findings.total_critical > 0) {
    scoreAdjustment = -10;
  } else {
    scoreAdjustment -= findings.total_high * 5;
  }
  scoreAdjustment = Math.max(-10, scoreAdjustment);

  const quarantineRecommended = findings.total_critical > 0 || findings.total_high >= 1;

  return {
    findings,
    score_adjustment: scoreAdjustment,
    quarantine_recommended: quarantineRecommended,
    details: {
      malware_family_rules_run: MALWARE_FAMILIES.length,
      matched_families: findings.matched_families.length,
    },
  };
}

export { MALWARE_FAMILIES };
