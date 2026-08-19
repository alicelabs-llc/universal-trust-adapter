# MarketNow — Vercel Analytics by Country

**Date:** 2026-07-16
**Source:** Vercel project analytics (two reporting windows)

## Window 1 (smaller)

| Country | Requests |
|---|---|
| 🇿🇦 ZA (South Africa) | 192 |
| 🇳🇱 NL (Netherlands) | 191 |
| 🇮🇪 IE (Ireland) | 84 |
| 🇺🇸 US | 53 |
| 🇩🇪 DE | 35 |
| 🇬🇧 GB | 34 |
| 🇨🇦 CA | 33 |
| 🇵🇱 PL | 6 |
| 🇫🇮 FI | 4 |
| 🇨🇿 CZ | 3 |
| 🇹🇷 TR | 3 |
| 🇧🇷 BR | 2 |
| 🇲🇦 MA | 1 |
| 🇸🇬 SG | 1 |
| 🇫🇷 FR | 1 |
| 🇧🇪 BE | 1 |
| T1 (Tor/anonymous) | 1 |

**Total:** ~615 requests, 17 countries

## Window 2 (larger)

| Country | Requests |
|---|---|
| 🇳🇱 NL | 564 |
| 🇺🇸 US | 434 |
| 🇫🇷 FR | 350 |
| 🇸🇪 SE | 249 |
| 🇿🇦 ZA | 193 |
| 🇮🇳 IN | 192 |
| 🇸🇬 SG | 141 |
| 🇩🇪 DE | 123 |
| 🇨🇦 CA | 117 |
| 🇧🇬 BG | 101 |
| 🇮🇪 IE | 88 |
| 🇬🇧 GB | 39 |
| 🇹🇷 TR | 34 |
| 🇱🇺 LU | 13 |
| 🇫🇮 FI | 11 |
| 🇨🇿 CZ | 7 |
| 🇧🇪 BE | 7 |
| 🇵🇱 PL | 6 |
| 🇱🇻 LV | 6 |
| 🇨🇳 CN | 5 |
| 🇧🇷 BR | 5 |
| 🇪🇸 ES | 5 |
| 🇺🇦 UA | 4 |
| 🇹🇼 TW | 4 |
| 🇲🇦 MA | 4 |
| 🇦🇺 AU | 3 |
| T1 (Tor) | 3 |
| 🇯🇵 JP | 2 |
| 🇦🇹 AT | 2 |
| 🇰🇷 KR | 2 |
| 🇮🇷 IR | 2 |
| 🇨🇱 CL | 1 |
| 🇱🇹 LT | 1 |

**Total:** ~2,500 requests, 33 countries

## Combined unique countries

33 unique countries across both windows.

## Honest analysis

- **NL dominance** is likely inflated by Vercel's EU edge PoPs (Amsterdam) + crawler traffic routed through EU edges.
- **US at 434** is the most reliable "real human" number.
- **South Africa (ZA)** consistently appears in both windows — interesting, unexplained.
- **T1** = Tor exit nodes / anonymous traffic.
- **npm installs (30 days):** 1,218 (mostly bots/CI, ~40/day avg)
- **Zero paying users.** Six mandates on the platform are all the founder's own testing.

## Verifiable at

- https://marketnow.site
- https://marketnow.site/api/security (8-layer Sentinel status)
- https://marketnow.site/trust (public trust page)
- https://registry.modelcontextprotocol.io/v0/servers?search=marketnow

— *Edison Flores, AliceLabs LLC*
