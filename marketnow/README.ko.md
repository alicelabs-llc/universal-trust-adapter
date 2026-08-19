# MarketNow — MCP 서버 마켓플레이스 (보안 우선)

> MarketNow는 MCP(모델 컨텍스트 프로토콜) 서버를 위한 보안 우선 마켓플레이스입니다. 9,248개 감사된 스킬, 10계층 보안 감사 파이프라인, Ed25519 서명된 에이전트 신뢰 카드(ATC).

## 모든 것 무료

| 기능 | 가격 |
|------|------|
| 모든 9,248 스킬 | 무료 |
| 10계층 보안 감사 | 무료 |
| 에이전트 신뢰 카드 (ATC) | 무료 |
| MCP 서버 (11 도구) | 무료 |
| 서버 제출 | 무료 |
| L2 Docker 샌드박스 감사 | 무료 |

## MCP 서버 제출

```bash
curl -X POST https://marketnow.site/api/submit-skill \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/your-username/your-mcp-server"}'
```

## 링크

- 웹사이트: https://marketnow.site
- 제출: https://marketnow.site/submit
- 사양: https://marketnow.site/api/atc?action=spec
- GitHub: https://github.com/edgarfloresguerra2011-a11y/marketnow
- npm: `npx -y marketnow-mcp@1.7.0`
