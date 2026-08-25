import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible text in 5 languages (en, es, pt, zh, fr)
// Brand names kept untranslated: MarketNow, MCP, Claude, Sentinel, x402, AP2,
// Cursor, GitHub.
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    badge: 'BLOG · SEO CONTENT',
    title: 'MarketNow Blog',
    subtitle:
      'Guides, tutorials, and deep dives on MCP servers, agent commerce, x402, AP2, and security.',
    readMore: 'Read more →',
    backToMarketplace: '← Back to marketplace',
    minReadSuffix: 'min read',
    posts: [
      {
        slug: 'top-20-mcp-servers-claude-desktop-2026',
        title: 'Top 20 MCP Servers for Claude Desktop in 2026',
        excerpt:
          'A curated list of the most useful MCP servers you can install in Claude Desktop right now. Each one Sentinel-scanned, with install command and use case.',
        date: '2026-07-02',
        readTime: 8,
        tags: ['mcp', 'claude', 'guide'],
      },
      {
        slug: 'what-is-x402-payment-protocol',
        title: 'What is x402? HTTP 402 Payment Required for AI agents',
        excerpt:
          'x402 revives the unused HTTP 402 status code for native HTTP-level payments. Learn how it works, why it matters for agent commerce, and how MarketNow implements it.',
        date: '2026-07-02',
        readTime: 5,
        tags: ['x402', 'payments', 'agents'],
      },
      {
        slug: 'ap2-agent-payments-protocol-explained',
        title:
          'AP2 (Agent Payments Protocol) explained: delegated mandates for AI agents',
        excerpt:
          'Google\'s AP2 protocol lets humans pre-authorize AI agents to spend within limits. Here\'s how it works, why human-in-the-loop matters, and how we implement it.',
        date: '2026-07-02',
        readTime: 6,
        tags: ['ap2', 'mandates', 'security'],
      },
      {
        slug: 'mcp-security-audit-sentinel-l15',
        title: 'How Sentinel v3.0 audits MCP servers (6-point security scan)',
        excerpt:
          'Sentinel v3.0 scans every MCP server for 6 security issues: auth, prompt injection, input validation, CORS, OAuth scopes, and rate limiting. Here\'s the methodology.',
        date: '2026-07-02',
        readTime: 7,
        tags: ['security', 'sentinel', 'mcp'],
      },
      {
        slug: 'install-mcp-server-cursor-step-by-step',
        title: 'How to install an MCP server in Cursor (step by step)',
        excerpt:
          'A complete guide to adding MCP servers to Cursor IDE. Includes configuration, troubleshooting, and 5 recommended servers to start with.',
        date: '2026-07-02',
        readTime: 4,
        tags: ['cursor', 'guide', 'mcp'],
      },
    ],
  },

  es: {
    badge: 'BLOG · CONTENIDO SEO',
    title: 'Blog de MarketNow',
    subtitle:
      'Guías, tutoriales y análisis profundos sobre servidores MCP, comercio de agentes, x402, AP2 y seguridad.',
    readMore: 'Leer más →',
    backToMarketplace: '← Volver al marketplace',
    minReadSuffix: 'min de lectura',
    posts: [
      {
        slug: 'top-20-mcp-servers-claude-desktop-2026',
        title: 'Los 20 mejores servidores MCP para Claude Desktop en 2026',
        excerpt:
          'Una lista curada de los servidores MCP más útiles que puedes instalar en Claude Desktop ahora mismo. Cada uno escaneado por Sentinel, con comando de instalación y caso de uso.',
        date: '2026-07-02',
        readTime: 8,
        tags: ['mcp', 'claude', 'guía'],
      },
      {
        slug: 'what-is-x402-payment-protocol',
        title: '¿Qué es x402? HTTP 402 Payment Required para agentes de IA',
        excerpt:
          'x402 recupera el código de estado HTTP 402 sin uso para pagos nativos a nivel HTTP. Aprende cómo funciona, por qué importa para el comercio de agentes y cómo lo implementa MarketNow.',
        date: '2026-07-02',
        readTime: 5,
        tags: ['x402', 'pagos', 'agentes'],
      },
      {
        slug: 'ap2-agent-payments-protocol-explained',
        title:
          'AP2 (Agent Payments Protocol) explicado: mandatos delegados para agentes de IA',
        excerpt:
          'El protocolo AP2 de Google permite a los humanos preautorizar a los agentes de IA a gastar dentro de límites. Aquí te explicamos cómo funciona, por qué importa el humano en el bucle y cómo lo implementamos.',
        date: '2026-07-02',
        readTime: 6,
        tags: ['ap2', 'mandatos', 'seguridad'],
      },
      {
        slug: 'mcp-security-audit-sentinel-l15',
        title: 'Cómo Sentinel v3.0 audita servidores MCP (escaneo de seguridad de 6 puntos)',
        excerpt:
          'Sentinel v3.0 escanea cada servidor MCP en busca de 6 problemas de seguridad: autenticación, prompt injection, validación de entrada, CORS, scopes de OAuth y rate limiting. Aquí está la metodología.',
        date: '2026-07-02',
        readTime: 7,
        tags: ['seguridad', 'sentinel', 'mcp'],
      },
      {
        slug: 'install-mcp-server-cursor-step-by-step',
        title: 'Cómo instalar un servidor MCP en Cursor (paso a paso)',
        excerpt:
          'Una guía completa para agregar servidores MCP a Cursor IDE. Incluye configuración, solución de problemas y 5 servidores recomendados para empezar.',
        date: '2026-07-02',
        readTime: 4,
        tags: ['cursor', 'guía', 'mcp'],
      },
    ],
  },

  pt: {
    badge: 'BLOG · CONTEÚDO SEO',
    title: 'Blog do MarketNow',
    subtitle:
      'Guias, tutoriais e análises profundas sobre servidores MCP, comércio de agentes, x402, AP2 e segurança.',
    readMore: 'Ler mais →',
    backToMarketplace: '← Voltar ao marketplace',
    minReadSuffix: 'min de leitura',
    posts: [
      {
        slug: 'top-20-mcp-servers-claude-desktop-2026',
        title: 'Os 20 melhores servidores MCP para Claude Desktop em 2026',
        excerpt:
          'Uma lista curada dos servidores MCP mais úteis que você pode instalar no Claude Desktop agora mesmo. Cada um escaneado pelo Sentinel, com comando de instalação e caso de uso.',
        date: '2026-07-02',
        readTime: 8,
        tags: ['mcp', 'claude', 'guia'],
      },
      {
        slug: 'what-is-x402-payment-protocol',
        title: 'O que é x402? HTTP 402 Payment Required para agentes de IA',
        excerpt:
          'x402 recupera o código de status HTTP 402 não utilizado para pagamentos nativos em nível HTTP. Saiba como funciona, por que importa para o comércio de agentes e como o MarketNow o implementa.',
        date: '2026-07-02',
        readTime: 5,
        tags: ['x402', 'pagamentos', 'agentes'],
      },
      {
        slug: 'ap2-agent-payments-protocol-explained',
        title:
          'AP2 (Agent Payments Protocol) explicado: mandatos delegados para agentes de IA',
        excerpt:
          'O protocolo AP2 do Google permite que humanos preautorizem agentes de IA a gastar dentro de limites. Veja como funciona, por que o humano no ciclo importa e como o implementamos.',
        date: '2026-07-02',
        readTime: 6,
        tags: ['ap2', 'mandatos', 'segurança'],
      },
      {
        slug: 'mcp-security-audit-sentinel-l15',
        title: 'Como o Sentinel v3.0 audita servidores MCP (escaneamento de segurança de 6 pontos)',
        excerpt:
          'O Sentinel v3.0 escaneia cada servidor MCP em busca de 6 problemas de segurança: autenticação, prompt injection, validação de entrada, CORS, escopos OAuth e rate limiting. Aqui está a metodologia.',
        date: '2026-07-02',
        readTime: 7,
        tags: ['segurança', 'sentinel', 'mcp'],
      },
      {
        slug: 'install-mcp-server-cursor-step-by-step',
        title: 'Como instalar um servidor MCP no Cursor (passo a passo)',
        excerpt:
          'Um guia completo para adicionar servidores MCP ao Cursor IDE. Inclui configuração, solução de problemas e 5 servidores recomendados para começar.',
        date: '2026-07-02',
        readTime: 4,
        tags: ['cursor', 'guia', 'mcp'],
      },
    ],
  },

  zh: {
    badge: '博客 · SEO 内容',
    title: 'MarketNow 博客',
    subtitle:
      '关于 MCP 服务器、智能体商务、x402、AP2 和安全的指南、教程与深度解析。',
    readMore: '阅读更多 →',
    backToMarketplace: '← 返回市场',
    minReadSuffix: '分钟阅读',
    posts: [
      {
        slug: 'top-20-mcp-servers-claude-desktop-2026',
        title: '2026 年 Claude Desktop 的 20 大 MCP 服务器',
        excerpt:
          '精选的最实用 MCP 服务器列表,你可以立即安装到 Claude Desktop。每一个都经过 Sentinel 扫描,附有安装命令和使用场景。',
        date: '2026-07-02',
        readTime: 8,
        tags: ['mcp', 'claude', '指南'],
      },
      {
        slug: 'what-is-x402-payment-protocol',
        title: '什么是 x402?面向 AI 智能体的 HTTP 402 Payment Required',
        excerpt:
          'x402 复活了未被使用的 HTTP 402 状态码,用于原生 HTTP 级别的支付。了解它的工作原理、为何对智能体商务至关重要,以及 MarketNow 如何实现它。',
        date: '2026-07-02',
        readTime: 5,
        tags: ['x402', '支付', '智能体'],
      },
      {
        slug: 'ap2-agent-payments-protocol-explained',
        title: 'AP2(智能体支付协议)详解:面向 AI 智能体的委托授权',
        excerpt:
          'Google 的 AP2 协议允许人类预先授权 AI 智能体在限额内消费。本文介绍其工作原理、为何人工介入至关重要,以及我们如何实现它。',
        date: '2026-07-02',
        readTime: 6,
        tags: ['ap2', '授权', '安全'],
      },
      {
        slug: 'mcp-security-audit-sentinel-l15',
        title: 'Sentinel v3.0 如何审计 MCP 服务器(6 项安全扫描)',
        excerpt:
          'Sentinel v3.0 扫描每个 MCP 服务器的 6 个安全问题:认证、提示词注入、输入验证、CORS、OAuth 作用域和速率限制。以下是方法论。',
        date: '2026-07-02',
        readTime: 7,
        tags: ['安全', 'sentinel', 'mcp'],
      },
      {
        slug: 'install-mcp-server-cursor-step-by-step',
        title: '如何在 Cursor 中安装 MCP 服务器(逐步教程)',
        excerpt:
          '一份完整的指南,教你如何在 Cursor IDE 中添加 MCP 服务器。包括配置、故障排除以及 5 个推荐的入门服务器。',
        date: '2026-07-02',
        readTime: 4,
        tags: ['cursor', '指南', 'mcp'],
      },
    ],
  },

  fr: {
    badge: 'BLOG · CONTENU SEO',
    title: 'Blog MarketNow',
    subtitle:
      'Guides, tutoriels et analyses approfondies sur les serveurs MCP, le commerce des agents, x402, AP2 et la sécurité.',
    readMore: 'Lire la suite →',
    backToMarketplace: '← Retour au marketplace',
    minReadSuffix: 'min de lecture',
    posts: [
      {
        slug: 'top-20-mcp-servers-claude-desktop-2026',
        title: 'Les 20 meilleurs serveurs MCP pour Claude Desktop en 2026',
        excerpt:
          'Une liste curée des serveurs MCP les plus utiles que vous pouvez installer dans Claude Desktop dès maintenant. Chacun scanné par Sentinel, avec commande d\'installation et cas d\'usage.',
        date: '2026-07-02',
        readTime: 8,
        tags: ['mcp', 'claude', 'guide'],
      },
      {
        slug: 'what-is-x402-payment-protocol',
        title: 'Qu\'est-ce que x402 ? HTTP 402 Payment Required pour les agents IA',
        excerpt:
          'x402 ressuscite le code d\'état HTTP 402 inutilisé pour des paiements natifs au niveau HTTP. Apprenez comment il fonctionne, pourquoi il compte pour le commerce des agents et comment MarketNow l\'implémente.',
        date: '2026-07-02',
        readTime: 5,
        tags: ['x402', 'paiements', 'agents'],
      },
      {
        slug: 'ap2-agent-payments-protocol-explained',
        title:
          'AP2 (Agent Payments Protocol) expliqué : mandats délégués pour les agents IA',
        excerpt:
          'Le protocole AP2 de Google permet aux humains de préautoriser les agents IA à dépenser dans des limites. Voici comment il fonctionne, pourquoi l\'humain dans la boucle compte et comment nous l\'implémentons.',
        date: '2026-07-02',
        readTime: 6,
        tags: ['ap2', 'mandats', 'sécurité'],
      },
      {
        slug: 'mcp-security-audit-sentinel-l15',
        title: 'Comment Sentinel v3.0 audite les serveurs MCP (scan de sécurité en 6 points)',
        excerpt:
          'Sentinel v3.0 scanne chaque serveur MCP à la recherche de 6 problèmes de sécurité : authentification, prompt injection, validation des entrées, CORS, scopes OAuth et rate limiting. Voici la méthodologie.',
        date: '2026-07-02',
        readTime: 7,
        tags: ['sécurité', 'sentinel', 'mcp'],
      },
      {
        slug: 'install-mcp-server-cursor-step-by-step',
        title: 'Comment installer un serveur MCP dans Cursor (étape par étape)',
        excerpt:
          'Un guide complet pour ajouter des serveurs MCP à Cursor IDE. Inclut la configuration, le dépannage et 5 serveurs recommandés pour démarrer.',
        date: '2026-07-02',
        readTime: 4,
        tags: ['cursor', 'guide', 'mcp'],
      },
    ],
  },
};

export default function Blog() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  return (
    <div className="min-h-screen pt-20 pb-20 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00F299]/10 border border-[#00F299]/20 mb-4">
            <span className="text-[#00F299] text-[10px] font-mono tracking-wider">{c.badge}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{c.title}</h1>
          <p className="text-zinc-400 text-lg">{c.subtitle}</p>
        </motion.div>

        <div className="space-y-4">
          {c.posts.map((post, i) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="premium-card p-6 hover:border-[#00F299]/30 transition-all"
            >
              <div className="flex items-center gap-3 mb-2 text-xs">
                <span className="text-zinc-500">{post.date}</span>
                <span className="text-zinc-700">·</span>
                <span className="text-zinc-500">{post.readTime} {c.minReadSuffix}</span>
                <div className="flex gap-1 ml-auto">
                  {post.tags.map(t => (
                    <span key={t} className="px-2 py-0.5 rounded bg-black/40 text-zinc-500 text-[10px] font-mono">#{t}</span>
                  ))}
                </div>
              </div>
              <h2 className="text-white text-xl font-bold mb-2 hover:text-[#00F299] cursor-pointer">
                {post.title}
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-3">{post.excerpt}</p>
              <Link to={`/blog/${post.slug}`} className="text-[#00F299] text-sm hover:underline">{c.readMore}</Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-[#00F299] text-sm hover:underline">{c.backToMarketplace}</Link>
        </div>
      </div>
    </div>
  );
}
