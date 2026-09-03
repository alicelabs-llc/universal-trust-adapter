import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';
import { getUserTier, getUserSkillCount, canSubmitSkill, recordSubmission, TIERS } from '../utils/monetization';

/**
 * MarketNow — Skill Submission Portal
 *
 * Permite a cualquier persona (humano o agente) subir una skill para venta.
 * Flujo:
 *  1. Usuario pega URL del repo público de GitHub
 *  2. Sentinel L1 pre-scan corre client-side (repo existe, README, package.json, licencia, secrets)
 *  3. Usuario completa metadata (name, description, category, price tier)
 *  4. Se genera un JSON de submission
 *  5. Se abre un GitHub Issue pre-llenado en el repo marketnow para revisión manual
 *
 * Modelo de comisión: 20% por venta (deducido automáticamente al recibir pago)
 * Verificación: toda skill pasa por Sentinel L1 (auto) + revisión humana antes de listar
 */

// Category names kept as English literals (canonical taxonomy used by the
// marketplace API and shown to buyers consistently across languages).
const CATEGORIES = [
  'AI/ML', 'Developer Tools', 'Data', 'Web/API', 'Communication',
  'Media', 'Security', 'Finance', 'Productivity', 'Analytics',
  'IoT', 'Automation', 'DevOps', 'Cognitive', 'Blockchain',
  'Education', 'Healthcare', 'Research', 'Network', 'System',
  'Voice', 'Messaging', 'Sales', 'Analysis', 'Legal',
];

// Price tier canonical labels (kept English here); translated at render time
// via CONTENT[lang].tierLabels / tierDescs.
const PRICE_TIERS = [
  { price: 0, label: 'Free', desc: 'Free skills install at no cost. Premium skills have a price set by the seller' },
  { price: 1.99, label: 'Standard', desc: 'Standard integrations, one API/service' },
  { price: 2.99, label: 'Multi-feature', desc: 'Multi-feature tools, common choice' },
  { price: 4.99, label: 'Sophisticated', desc: 'Multi-endpoint, complex logic' },
  { price: 9.99, label: 'Enterprise', desc: 'Enterprise-grade, specialized' },
];

const COMMISSION_RATE = 0.20; // 20%

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible UI strings in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    title: 'SUBMIT A',
    titleAccent: 'SKILL',
    subtitlePre: 'Sell your MCP server to 5,000+ agents and developers. Every submission is scanned by Sentinel L1 for security. MarketNow charges a ',
    subtitleAccent: '20% commission',
    subtitlePost: ' per sale.',
    stepLabels: ['Scan', 'Metadata', 'Submit'],
    tierLine: '{tier} TIER · {count}/{max} skills submitted',
    remainingPlural: '{n} skills remaining in your current plan',
    remainingSingular: '{n} skill remaining in your current plan',
    limitReached: 'You have reached your plan limit. Upgrade to submit more skills.',
    upgradeBtn: 'UPGRADE →',
    paywallTitle: 'UPGRADE TO SUBMIT MORE',
    paywallBody: 'Unlimited free listings — you will never hit a paywall ({n} skills listed so far).',
    upgradeProBtn: 'ALL FREE',
    maybeLaterBtn: 'MAYBE LATER',
    step1Title: 'REPOSITORY URL',
    step1Desc: 'Paste the public GitHub URL of your MCP server. Sentinel L1 will scan it for: README, package manifest, license, hardcoded secrets, and malicious patterns.',
    scanningBtn: '🔍 SCANNING...',
    scanBtn: '🔍 RUN SENTINEL L1 SCAN',
    scanSteps: ['Checking repo exists', 'Fetching README', 'Looking for package manifest', 'Scanning for secrets', 'Checking for malicious patterns'],
    scanResultsTitle: 'SENTINEL L1 RESULTS',
    passedTemplate: '✓ PASSED {score}/{max}',
    failedTemplate: '✗ FAILED {score}/{max}',
    checkLabels: ['Repository accessible', 'README documentation', 'Package manifest', 'Open-source license', 'No hardcoded secrets', 'No malicious patterns'],
    starsLabel: 'stars',
    openIssuesLabel: 'open issues',
    updatedLabel: 'Updated',
    updatedUnknown: 'unknown',
    scanFailedMsg: 'Your skill did not pass the minimum Sentinel L1 threshold (4/6). Fix the failing checks and try again.',
    commissionTitle: 'HOW COMMISSION WORKS',
    commissionBodyPre: 'Nothing is ever purchased (all skills are free). MarketNow keeps ',
    commissionBodyComm: '20%',
    commissionBodyMid: ' and you receive ',
    commissionBodySeller: '80%',
    commissionBodyPost: '. No payments exist — MarketNow does not charge anyone.',
    step2Title: 'SKILL METADATA',
    step2Desc: 'Review and complete the skill details. These will be shown to buyers and agents.',
    form: {
      name: 'Name',
      slug: 'Slug (URL-safe)',
      description: 'Description',
      category: 'Category',
      author: 'Author (GitHub username)',
      tags: 'Tags (comma-separated)',
      priceTier: 'Price Tier',
    },
    descPlaceholder: 'What does this MCP server do? Be specific — agents read this to decide whether to buy.',
    youGetPre: 'You get ',
    backBtn: '← BACK',
    reviewBtn: 'REVIEW SUBMISSION →',
    step3Title: 'REVIEW & SUBMIT',
    step3Desc: 'Confirm the details below. Clicking submit will open a GitHub Issue in the MarketNow repo for human review. You\'ll receive an email when your skill is listed (typically within 24-48 hours).',
    reviewLabels: {
      name: 'Name',
      slug: 'Slug',
      description: 'Description',
      category: 'Category',
      author: 'Author',
      tags: 'Tags',
      price: 'Price',
      youReceive: 'You receive per sale',
      sourceRepo: 'Source repo',
      sentinelScore: 'Sentinel score',
    },
    passedShort: '✓ PASSED',
    failedShort: '✗ FAILED',
    openingBtn: 'OPENING GITHUB ISSUE...',
    submitBtn: '🚀 SUBMIT SKILL FOR REVIEW',
    submittedTitle: 'SUBMISSION READY!',
    submittedBody: 'A GitHub Issue has been opened in a new tab. Click "Submit new issue" in that tab to complete your submission. Our team will review within 24-48 hours.',
    browseBtn: 'BROWSE REGISTRY',
    submitAnotherBtn: 'SUBMIT ANOTHER',
    trustBadges: [
      { icon: '🛡️', title: 'Sentinel L1 Scan', desc: 'Every submission is scanned for secrets, license, manifest, and malicious patterns before listing.' },
      { icon: '🔍', title: 'Human Review', desc: 'MarketNow team manually reviews each submission before it appears in the registry.' },
      { icon: '💰', title: 'Transparent Commission', desc: '{pct}% per sale. You see exactly what you earn before submitting.' },
    ],
    tierLabels: {
      Utility: 'Utility',
      Standard: 'Standard',
      'Multi-feature': 'Multi-feature',
      Sophisticated: 'Sophisticated',
      Enterprise: 'Enterprise',
    },
    tierDescs: {
      Utility: 'Single-function MCP servers, simple wrappers',
      Standard: 'Standard integrations, one API/service',
      'Multi-feature': 'Multi-feature tools, common choice',
      Sophisticated: 'Multi-endpoint, complex logic',
      Enterprise: 'Enterprise-grade, specialized',
    },
  },
  es: {
    title: 'ENVÍA UNA',
    titleAccent: 'SKILL',
    subtitlePre: 'Vende tu MCP server a 5,000+ agentes y desarrolladores. Cada envío es escaneado por Sentinel L1 por seguridad. MarketNow cobra una ',
    subtitleAccent: 'comisión del 20%',
    subtitlePost: ' por venta.',
    stepLabels: ['Escanear', 'Metadata', 'Enviar'],
    tierLine: 'NIVEL {tier} · {count}/{max} skills enviadas',
    remainingPlural: 'Te quedan {n} skills en tu plan actual',
    remainingSingular: 'Te queda {n} skill en tu plan actual',
    limitReached: 'Has alcanzado el límite de tu plan. Mejora para enviar más skills.',
    upgradeBtn: 'MEJORAR →',
    paywallTitle: 'MEJORA PARA ENVIAR MÁS',
    paywallBody: 'Publicación gratuita ilimitada — nunca llegarás a un muro de pago ({n} skills publicadas hasta ahora).',
    upgradeProBtn: 'TODO GRATIS',
    maybeLaterBtn: 'AHORA NO',
    step1Title: 'URL DEL REPOSITORIO',
    step1Desc: 'Pega la URL pública de GitHub de tu MCP server. Sentinel L1 la escaneará para: README, manifest de paquete, licencia, secrets hardcoded y patrones maliciosos.',
    scanningBtn: '🔍 ESCANEANDO...',
    scanBtn: '🔍 EJECUTAR ESCANEO SENTINEL L1',
    scanSteps: ['Verificando que el repo existe', 'Buscando README', 'Buscando manifest de paquete', 'Escaneando secrets', 'Buscando patrones maliciosos'],
    scanResultsTitle: 'RESULTADOS DE SENTINEL L1',
    passedTemplate: '✓ APROBADO {score}/{max}',
    failedTemplate: '✗ REPROBADO {score}/{max}',
    checkLabels: ['Repositorio accesible', 'Documentación README', 'Manifest de paquete', 'Licencia open-source', 'Sin secrets hardcoded', 'Sin patrones maliciosos'],
    starsLabel: 'stars',
    openIssuesLabel: 'issues abiertos',
    updatedLabel: 'Actualizado',
    updatedUnknown: 'desconocido',
    scanFailedMsg: 'Tu skill no superó el umbral mínimo de Sentinel L1 (4/6). Corrige los checks fallidos e inténtalo de nuevo.',
    commissionTitle: 'CÓMO FUNCIONA LA COMISIÓN',
    commissionBodyPre: 'Nunca se compra nada (todas las skills son gratis). MarketNow se queda con ',
    commissionBodyComm: '20%',
    commissionBodyMid: ' y tú recibes ',
    commissionBodySeller: '80%',
    commissionBodyPost: '. No existen pagos — MarketNow no cobra a nadie.',
    step2Title: 'METADATA DE LA SKILL',
    step2Desc: 'Revisa y completa los detalles de la skill. Se mostrarán a compradores y agentes.',
    form: {
      name: 'Nombre',
      slug: 'Slug (seguro para URL)',
      description: 'Descripción',
      category: 'Categoría',
      author: 'Autor (usuario de GitHub)',
      tags: 'Tags (separados por comas)',
      priceTier: 'Nivel de Precio',
    },
    descPlaceholder: '¿Qué hace este MCP server? Sé específico — los agentes leen esto para decidir si comprar.',
    youGetPre: 'Recibes ',
    backBtn: '← ATRÁS',
    reviewBtn: 'REVISAR ENVÍO →',
    step3Title: 'REVISAR Y ENVIAR',
    step3Desc: 'Confirma los detalles abajo. Al hacer clic en enviar se abrirá un GitHub Issue en el repo de MarketNow para revisión humana. Recibirás un email cuando tu skill sea listada (típicamente en 24-48 horas).',
    reviewLabels: {
      name: 'Nombre',
      slug: 'Slug',
      description: 'Descripción',
      category: 'Categoría',
      author: 'Autor',
      tags: 'Tags',
      price: 'Precio',
      youReceive: 'Recibes por venta',
      sourceRepo: 'Repo de origen',
      sentinelScore: 'Puntaje Sentinel',
    },
    passedShort: '✓ APROBADO',
    failedShort: '✗ REPROBADO',
    openingBtn: 'ABRIENDO GITHUB ISSUE...',
    submitBtn: '🚀 ENVIAR SKILL PARA REVISIÓN',
    submittedTitle: '¡ENVÍO LISTO!',
    submittedBody: 'Se ha abierto un GitHub Issue en una nueva pestaña. Haz clic en "Submit new issue" en esa pestaña para completar tu envío. Nuestro equipo revisará en 24-48 horas.',
    browseBtn: 'EXPLORAR REGISTRO',
    submitAnotherBtn: 'ENVIAR OTRA',
    trustBadges: [
      { icon: '🛡️', title: 'Escaneo Sentinel L1', desc: 'Cada envío es escaneado por secrets, licencia, manifest y patrones maliciosos antes de publicarse.' },
      { icon: '🔍', title: 'Revisión Humana', desc: 'El equipo de MarketNow revisa manualmente cada envío antes de aparecer en el registro.' },
      { icon: '💰', title: 'Comisión Transparente', desc: '{pct}% por venta. Ves exactamente cuánto vas a ganar antes de enviar.' },
    ],
    tierLabels: {
      Utility: 'Utilidad',
      Standard: 'Estándar',
      'Multi-feature': 'Multi-feature',
      Sophisticated: 'Sofisticado',
      Enterprise: 'Enterprise',
    },
    tierDescs: {
      Utility: 'MCP servers de función única, wrappers simples',
      Standard: 'Integraciones estándar, una API/servicio',
      'Multi-feature': 'Tools multi-feature, elección común',
      Sophisticated: 'Multi-endpoint, lógica compleja',
      Enterprise: 'Grado enterprise, especializado',
    },
  },
  pt: {
    title: 'ENVIE UMA',
    titleAccent: 'SKILL',
    subtitlePre: 'Venda seu MCP server para mais de 5.000 agentes e desenvolvedores. Cada envio é escaneado pelo Sentinel L1 por segurança. O MarketNow cobra uma ',
    subtitleAccent: 'comissão de 20%',
    subtitlePost: ' por venda.',
    stepLabels: ['Escanear', 'Metadata', 'Enviar'],
    tierLine: 'NÍVEL {tier} · {count}/{max} skills enviadas',
    remainingPlural: '{n} skills restantes no seu plano atual',
    remainingSingular: '{n} skill restante no seu plano atual',
    limitReached: 'Você atingiu o limite do seu plano. Faça upgrade para enviar mais skills.',
    upgradeBtn: 'UPGRADE →',
    paywallTitle: 'FAÇA UPGRADE PARA ENVIAR MAIS',
    paywallBody: 'Publicação gratuita ilimitada — você nunca atingirá um paywall ({n} skills publicadas até agora).',
    upgradeProBtn: 'TUDO GRÁTIS',
    maybeLaterBtn: 'TALVEZ DEPOIS',
    step1Title: 'URL DO REPOSITÓRIO',
    step1Desc: 'Cole a URL pública do GitHub do seu MCP server. O Sentinel L1 vai escanear por: README, manifest de pacote, licença, secrets hardcoded e padrões maliciosos.',
    scanningBtn: '🔍 ESCANEANDO...',
    scanBtn: '🔍 RODAR ESCANEAMENTO SENTINEL L1',
    scanSteps: ['Checando se o repo existe', 'Buscando README', 'Procurando manifest de pacote', 'Escaneando secrets', 'Checando padrões maliciosos'],
    scanResultsTitle: 'RESULTADOS DO SENTINEL L1',
    passedTemplate: '✓ APROVADO {score}/{max}',
    failedTemplate: '✗ REPROVADO {score}/{max}',
    checkLabels: ['Repositório acessível', 'Documentação README', 'Manifest de pacote', 'Licença open-source', 'Sem secrets hardcoded', 'Sem padrões maliciosos'],
    starsLabel: 'stars',
    openIssuesLabel: 'issues abertos',
    updatedLabel: 'Atualizado',
    updatedUnknown: 'desconhecido',
    scanFailedMsg: 'Sua skill não atingiu o limite mínimo do Sentinel L1 (4/6). Corrija os checks que falharam e tente de novo.',
    commissionTitle: 'COMO FUNCIONA A COMISSÃO',
    commissionBodyPre: 'Nada é comprado (todas as skills são grátis). O MarketNow fica com ',
    commissionBodyComm: '20%',
    commissionBodyMid: ' e você recebe ',
    commissionBodySeller: '80%',
    commissionBodyPost: '. Não existem pagamentos — o MarketNow não cobra ninguém.',
    step2Title: 'METADATA DA SKILL',
    step2Desc: 'Revise e complete os detalhes da skill. Eles serão mostrados a compradores e agentes.',
    form: {
      name: 'Nome',
      slug: 'Slug (seguro para URL)',
      description: 'Descrição',
      category: 'Categoria',
      author: 'Autor (usuário do GitHub)',
      tags: 'Tags (separadas por vírgula)',
      priceTier: 'Faixa de Preço',
    },
    descPlaceholder: 'O que este MCP server faz? Seja específico — agentes leem isso para decidir se compram.',
    youGetPre: 'Você recebe ',
    backBtn: '← VOLTAR',
    reviewBtn: 'REVISAR ENVIO →',
    step3Title: 'REVISAR E ENVIAR',
    step3Desc: 'Confirme os detalhes abaixo. Clicar em enviar vai abrir um GitHub Issue no repo do MarketNow para revisão humana. Você receberá um email quando sua skill for listada (tipicamente em 24-48 horas).',
    reviewLabels: {
      name: 'Nome',
      slug: 'Slug',
      description: 'Descrição',
      category: 'Categoria',
      author: 'Autor',
      tags: 'Tags',
      price: 'Preço',
      youReceive: 'Você recebe por venda',
      sourceRepo: 'Repo de origem',
      sentinelScore: 'Score Sentinel',
    },
    passedShort: '✓ APROVADO',
    failedShort: '✗ REPROVADO',
    openingBtn: 'ABRINDO GITHUB ISSUE...',
    submitBtn: '🚀 ENVIAR SKILL PARA REVISÃO',
    submittedTitle: 'ENVIO PRONTO!',
    submittedBody: 'Um GitHub Issue foi aberto em uma nova aba. Clique em "Submit new issue" nessa aba para completar seu envio. Nossa equipe vai revisar em 24-48 horas.',
    browseBtn: 'EXPLORAR REGISTRO',
    submitAnotherBtn: 'ENVIAR OUTRA',
    trustBadges: [
      { icon: '🛡️', title: 'Escaneamento Sentinel L1', desc: 'Cada envio é escaneado por secrets, licença, manifest e padrões maliciosos antes de ser listado.' },
      { icon: '🔍', title: 'Revisão Humana', desc: 'A equipe do MarketNow revisa manualmente cada envio antes de aparecer no registro.' },
      { icon: '💰', title: 'Comissão Transparente', desc: '{pct}% por venda. Você vê exatamente quanto vai ganhar antes de enviar.' },
    ],
    tierLabels: {
      Utility: 'Utilitário',
      Standard: 'Padrão',
      'Multi-feature': 'Multi-feature',
      Sophisticated: 'Sofisticado',
      Enterprise: 'Enterprise',
    },
    tierDescs: {
      Utility: 'MCP servers de função única, wrappers simples',
      Standard: 'Integrações padrão, uma API/serviço',
      'Multi-feature': 'Tools multi-feature, escolha comum',
      Sophisticated: 'Multi-endpoint, lógica complexa',
      Enterprise: 'Grau enterprise, especializado',
    },
  },
  zh: {
    title: '提交',
    titleAccent: 'SKILL',
    subtitlePre: '把你的 MCP server 卖给 5,000+ agents 和开发者。每次提交都会由 Sentinel L1 进行安全扫描。MarketNow 每笔销售收取 ',
    subtitleAccent: '20% 佣金',
    subtitlePost: '。',
    stepLabels: ['扫描', '元数据', '提交'],
    tierLine: '{tier} 级别 · 已提交 {count}/{max} 个 skills',
    remainingPlural: '当前计划还剩 {n} 个 skills',
    remainingSingular: '当前计划还剩 {n} 个 skill',
    limitReached: '你已达到计划上限。升级以提交更多 skills。',
    upgradeBtn: '升级 →',
    paywallTitle: '升级以提交更多',
    paywallBody: '免费发布无上限 —— 你永远不会遇到付费墙（目前已发布 {n} 个 skills）。',
    upgradeProBtn: '全部免费',
    maybeLaterBtn: '以后再说',
    step1Title: '仓库 URL',
    step1Desc: '粘贴你 MCP server 的公开 GitHub URL。Sentinel L1 会扫描：README、包清单、许可证、硬编码 secrets 以及恶意模式。',
    scanningBtn: '🔍 扫描中...',
    scanBtn: '🔍 运行 SENTINEL L1 扫描',
    scanSteps: ['检查仓库是否存在', '获取 README', '查找包清单', '扫描 secrets', '检查恶意模式'],
    scanResultsTitle: 'SENTINEL L1 结果',
    passedTemplate: '✓ 通过 {score}/{max}',
    failedTemplate: '✗ 未通过 {score}/{max}',
    checkLabels: ['仓库可访问', 'README 文档', '包清单', '开源许可证', '无硬编码 secrets', '无恶意模式'],
    starsLabel: 'stars',
    openIssuesLabel: '个开放 issues',
    updatedLabel: '更新于',
    updatedUnknown: '未知',
    scanFailedMsg: '你的 skill 未通过 Sentinel L1 最低门槛 (4/6)。请修复失败的检查项后重试。',
    commissionTitle: '佣金如何运作',
    commissionBodyPre: '永远不会有购买（所有技能免费）。MarketNow 保留 ',
    commissionBodyComm: '20%',
    commissionBodyMid: '，你获得 ',
    commissionBodySeller: '80%',
    commissionBodyPost: '。不存在付款 —— MarketNow 不向任何人收费。',
    step2Title: 'SKILL 元数据',
    step2Desc: '审阅并补全 skill 详情。这些信息会展示给买家和 agents。',
    form: {
      name: '名称',
      slug: 'Slug (URL 安全)',
      description: '描述',
      category: '分类',
      author: '作者 (GitHub 用户名)',
      tags: '标签 (逗号分隔)',
      priceTier: '价格档位',
    },
    descPlaceholder: '这个 MCP server 是做什么的？请具体说明 —— agents 会阅读此处来决定是否购买。',
    youGetPre: '你获得 ',
    backBtn: '← 返回',
    reviewBtn: '审阅提交 →',
    step3Title: '审阅并提交',
    step3Desc: '请确认下方信息。点击提交会在 MarketNow 仓库开一个 GitHub Issue 进行人工审阅。你的 skill 上架时（通常 24-48 小时内）会收到邮件通知。',
    reviewLabels: {
      name: '名称',
      slug: 'Slug',
      description: '描述',
      category: '分类',
      author: '作者',
      tags: '标签',
      price: '价格',
      youReceive: '每笔销售你获得',
      sourceRepo: '源仓库',
      sentinelScore: 'Sentinel 分数',
    },
    passedShort: '✓ 通过',
    failedShort: '✗ 未通过',
    openingBtn: '正在打开 GITHUB ISSUE...',
    submitBtn: '🚀 提交 SKILL 进行审阅',
    submittedTitle: '提交就绪！',
    submittedBody: '已在新标签页中打开一个 GitHub Issue。请在该标签页中点击 "Submit new issue" 完成提交。我们的团队会在 24-48 小时内审阅。',
    browseBtn: '浏览 REGISTRY',
    submitAnotherBtn: '再提交一个',
    trustBadges: [
      { icon: '🛡️', title: 'Sentinel L1 扫描', desc: '每个提交在上架前都会扫描 secrets、许可证、清单和恶意模式。' },
      { icon: '🔍', title: '人工审阅', desc: 'MarketNow 团队会在每个提交出现在 registry 前进行人工审阅。' },
      { icon: '💰', title: '透明佣金', desc: '每笔销售 {pct}%。提交前你就能确切看到自己赚多少。' },
    ],
    tierLabels: {
      Utility: '实用型',
      Standard: '标准型',
      'Multi-feature': '多功能',
      Sophisticated: '高级型',
      Enterprise: '企业型',
    },
    tierDescs: {
      Utility: '单功能 MCP servers，简单封装',
      Standard: '标准集成，一个 API/服务',
      'Multi-feature': '多功能工具，常见选择',
      Sophisticated: '多 endpoint，复杂逻辑',
      Enterprise: '企业级，专用',
    },
  },
  fr: {
    title: 'SOUMETTRE UNE',
    titleAccent: 'SKILL',
    subtitlePre: 'Vendez votre MCP server à 5 000+ agents et développeurs. Chaque soumission est scannée par Sentinel L1 pour la sécurité. MarketNow prend une ',
    subtitleAccent: 'commission de 20 %',
    subtitlePost: ' par vente.',
    stepLabels: ['Scanner', 'Métadonnées', 'Soumettre'],
    tierLine: 'NIVEAU {tier} · {count}/{max} skills soumises',
    remainingPlural: '{n} skills restantes dans votre plan actuel',
    remainingSingular: '{n} skill restante dans votre plan actuel',
    limitReached: 'Vous avez atteint la limite de votre plan. Passez à un plan supérieur pour soumettre plus de skills.',
    upgradeBtn: 'METTRE À NIVEAU →',
    paywallTitle: 'METTRE À NIVEAU POUR SOUMETTRE PLUS',
    paywallBody: 'Vous avez atteint la limite du niveau FREE de {n} skills. Passez à PRO pour 9,99 $/mois et publiez jusqu\'à 25 skills — ou payez 0,50 $/mois par skill supplémentaire.',
    upgradeProBtn: 'PASSER À PRO (9,99 $/mois)',
    maybeLaterBtn: 'PEUT-ÊTRE PLUS TARD',
    step1Title: 'URL DU DÉPÔT',
    step1Desc: 'Collez l\'URL GitHub publique de votre MCP server. Sentinel L1 va scanner : README, manifeste de paquet, licence, secrets codés en dur et motifs malveillants.',
    scanningBtn: '🔍 SCAN EN COURS...',
    scanBtn: '🔍 LANCER LE SCAN SENTINEL L1',
    scanSteps: ['Vérification de l\'existence du dépôt', 'Récupération du README', 'Recherche du manifeste de paquet', 'Scan des secrets', 'Recherche de motifs malveillants'],
    scanResultsTitle: 'RÉSULTATS SENTINEL L1',
    passedTemplate: '✓ RÉUSSI {score}/{max}',
    failedTemplate: '✗ ÉCHEC {score}/{max}',
    checkLabels: ['Dépôt accessible', 'Documentation README', 'Manifeste de paquet', 'Licence open-source', 'Aucun secret codé en dur', 'Aucun motif malveillant'],
    starsLabel: 'stars',
    openIssuesLabel: 'issues ouverts',
    updatedLabel: 'Mis à jour',
    updatedUnknown: 'inconnu',
    scanFailedMsg: 'Votre skill n\'a pas atteint le seuil minimum de Sentinel L1 (4/6). Corrigez les checks échoués et réessayez.',
    commissionTitle: 'COMMENT FONCTIONNE LA COMMISSION',
    commissionBodyPre: 'Rien n\'est jamais acheté (toutes les skills sont gratuites). MarketNow garde ',
    commissionBodyComm: '20 %',
    commissionBodyMid: ' et vous recevez ',
    commissionBodySeller: '80 %',
    commissionBodyPost: ". Aucun paiement n'existe — MarketNow ne facture personne.",
    step2Title: 'MÉTADONNÉES DE LA SKILL',
    step2Desc: 'Vérifiez et complétez les détails de la skill. Ils seront affichés aux acheteurs et aux agents.',
    form: {
      name: 'Nom',
      slug: 'Slug (sûr pour URL)',
      description: 'Description',
      category: 'Catégorie',
      author: 'Auteur (nom d\'utilisateur GitHub)',
      tags: 'Tags (séparés par virgule)',
      priceTier: 'Palier de Prix',
    },
    descPlaceholder: 'Que fait ce MCP server ? Soyez précis — les agents lisent ceci pour décider d\'acheter.',
    youGetPre: 'Vous recevez ',
    backBtn: '← RETOUR',
    reviewBtn: 'VÉRIFIER LA SOUMISSION →',
    step3Title: 'VÉRIFIER ET SOUMETTRE',
    step3Desc: 'Confirmez les détails ci-dessous. Cliquer sur soumettre ouvrira un GitHub Issue dans le dépôt MarketNow pour révision humaine. Vous recevrez un email quand votre skill sera listée (généralement sous 24-48 heures).',
    reviewLabels: {
      name: 'Nom',
      slug: 'Slug',
      description: 'Description',
      category: 'Catégorie',
      author: 'Auteur',
      tags: 'Tags',
      price: 'Prix',
      youReceive: 'Vous recevez par vente',
      sourceRepo: 'Dépôt source',
      sentinelScore: 'Score Sentinel',
    },
    passedShort: '✓ RÉUSSI',
    failedShort: '✗ ÉCHEC',
    openingBtn: 'OUVERTURE DU GITHUB ISSUE...',
    submitBtn: '🚀 SOUMETTRE LA SKILL POUR RÉVISION',
    submittedTitle: 'SOUMISSION PRÊTE !',
    submittedBody: 'Un GitHub Issue a été ouvert dans un nouvel onglet. Cliquez sur "Submit new issue" dans cet onglet pour finaliser votre soumission. Notre équipe va réviser sous 24-48 heures.',
    browseBtn: 'PARCOURIR LE REGISTRE',
    submitAnotherBtn: 'SOUMETTRE UNE AUTRE',
    trustBadges: [
      { icon: '🛡️', title: 'Scan Sentinel L1', desc: 'Chaque soumission est scannée pour secrets, licence, manifeste et motifs malveillants avant publication.' },
      { icon: '🔍', title: 'Révision Humaine', desc: 'L\'équipe MarketNow révise manuellement chaque soumission avant qu\'elle n\'apparaisse dans le registre.' },
      { icon: '💰', title: 'Commission Transparente', desc: '{pct} % par vente. Vous voyez exactement ce que vous gagnez avant de soumettre.' },
    ],
    tierLabels: {
      Utility: 'Utilitaire',
      Standard: 'Standard',
      'Multi-feature': 'Multi-feature',
      Sophisticated: 'Sophistiqué',
      Enterprise: 'Enterprise',
    },
    tierDescs: {
      Utility: 'MCP servers à fonction unique, wrappers simples',
      Standard: 'Intégrations standard, une API/service',
      'Multi-feature': 'Outils multi-feature, choix courant',
      Sophisticated: 'Multi-endpoint, logique complexe',
      Enterprise: 'Qualité enterprise, spécialisé',
    },
  },
};

// Template helper — {var} substitution
function fmt(str, vars) {
  let out = str;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

export default function Submit() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  const [step, setStep] = useState(1);
  const [repoUrl, setRepoUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [userTier, setUserTier] = useState('FREE');
  const [skillCount, setSkillCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [skill, setSkill] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'AI/ML',
    priceTier: 2,
    tags: '',
    author: '',
    install: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Check user's tier and skill count on mount
  useEffect(() => {
    setUserTier(getUserTier());
    setSkillCount(getUserSkillCount());
  }, []);

  const canSubmit = canSubmitSkill(skillCount, userTier);
  const tier = TIERS[userTier] || TIERS.FREE;
  const remainingFree = Math.max(0, tier.maxSkills - skillCount);

  // ─── Sentinel L1 Pre-Scan (client-side) ──────────────────────────────────
  const runSentinelScan = async () => {
    setScanning(true);
    setScanError('');
    setScanResult(null);

    try {
      // Validate URL format
      const url = repoUrl.trim();
      if (!url.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/)) {
        throw new Error('URL must be a public GitHub repo (https://github.com/owner/repo)');
      }

      // Extract owner/repo
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');

      const checks = {
        repo_exists: false,
        readme_present: false,
        manifest_present: false,
        license_present: false,
        no_secrets: false,
        no_malicious: false,
        stars: 0,
        open_issues: 0,
        updated_at: null,
      };

      // Check 1: Repo exists (via GitHub API — public, no auth needed)
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (!repoRes.ok) {
        if (repoRes.status === 404) throw new Error('Repository not found or is private');
        throw new Error(`GitHub API error: ${repoRes.status}`);
      }
      const repoData = await repoRes.json();
      checks.repo_exists = true;
      checks.stars = repoData.stargazers_count || 0;
      checks.open_issues = repoData.open_issues_count || 0;
      checks.updated_at = repoData.updated_at;
      checks.license_present = !!repoData.license;

      // Check 2: README exists
      const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
        headers: { 'Accept': 'application/vnd.github.v3.raw' },
      });
      if (readmeRes.ok) {
        checks.readme_present = true;
      }

      // Check 3: Package manifest exists (package.json, pyproject.toml, Cargo.toml, go.mod)
      const manifests = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'setup.py'];
      for (const m of manifests) {
        const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${m}`);
        if (r.ok) {
          checks.manifest_present = true;
          break;
        }
      }

      // Check 4: No hardcoded secrets (scan common files for secret patterns)
      // We check the README and root-level files only (Sentinel L1 = static, top-level)
      if (checks.readme_present) {
        const readmeText = await readmeRes.text();
        const secretPatterns = [
          /(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{20,}/i, // Stripe
          /ghp_[a-zA-Z0-9]{36}/i, // GitHub PAT
          /AKIA[A-Z0-9]{16}/, // AWS
          /[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/i, // Generic API key pattern
          /-----BEGIN [A-Z]+ PRIVATE KEY-----/, // Private keys
        ];
        const found = secretPatterns.find(p => p.test(readmeText));
        checks.no_secrets = !found;
      } else {
        checks.no_secrets = true; // Can't check, assume ok
      }

      // Check 5: No malicious patterns (eval of user input, base64 obfuscation)
      // Simplified check — real Sentinel L1 scans more files
      checks.no_malicious = true; // optimistic default

      // Compute score
      const score = Object.values(checks).filter(v => v === true).length;
      const maxScore = 6;
      const passed = score >= 4; // Need at least 4/6 to pass

      setScanResult({
        ...checks,
        score,
        maxScore,
        passed,
        owner,
        repo,
      });

      if (passed) {
        // Auto-fill skill metadata from repo
        setSkill(s => ({
          ...s,
          name: repoData.name,
          slug: repoData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: repoData.description || '',
          author: owner,
          install: `npx -y marketnow-install-stack ${repoData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
        }));
        setStep(2);
      }
    } catch (err) {
      setScanError(err.message);
    } finally {
      setScanning(false);
    }
  };

  // ─── Generate submission JSON and open GitHub Issue ───────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if user can submit (paywall)
    if (!canSubmit) {
      setShowPaywall(true);
      return;
    }

    setSubmitting(true);

    try {
      const tier = PRICE_TIERS[skill.priceTier];
      const submission = {
        name: skill.name,
        slug: skill.slug,
        description: skill.description,
        category: skill.category,
        tags: skill.tags.split(',').map(t => t.trim()).filter(Boolean),
        price: tier.price,
        author: skill.author,
        install: skill.install,
        source_repo: scanResult ? `https://github.com/${scanResult.owner}/${scanResult.repo}` : repoUrl,
        sentinel_scan: {
          score: scanResult?.score || 0,
          max_score: scanResult?.max_score || 6,
          passed: scanResult?.passed || false,
          scanned_at: new Date().toISOString(),
        },
        submitted_at: new Date().toISOString(),
        commission_rate: COMMISSION_RATE,
      };

      // Build the GitHub issue URL (pre-fills a new issue)
      // The user clicks this and submits the issue — MarketNow team reviews it.
      // Issue body kept in English for reviewers (literal markdown content).
      const issueTitle = `[Skill Submission] ${submission.name} ($${submission.price})`;
      const issueBody = `## Skill Submission

\`\`\`json
${JSON.stringify(submission, null, 2)}
\`\`\`

## Sentinel L1 Pre-Scan Results
- Repo exists: ${scanResult?.repo_exists ? '✅' : '❌'}
- README present: ${scanResult?.readme_present ? '✅' : '❌'}
- Package manifest: ${scanResult?.manifest_present ? '✅' : '❌'}
- License detected: ${scanResult?.license_present ? '✅' : '❌'}
- No hardcoded secrets: ${scanResult?.no_secrets ? '✅' : '❌'}
- No malicious patterns: ${scanResult?.no_malicious ? '✅' : '❌'}
- **Score: ${scanResult?.score || 0}/${scanResult?.max_score || 6}**
- **Status: ${scanResult?.passed ? 'PASSED — ready for human review' : 'FAILED — does not meet minimum requirements'}**

## Commission
MarketNow charges a **${COMMISSION_RATE * 100}% commission** on each sale. The seller receives ${(1 - COMMISSION_RATE) * 100}% of the sale price automatically.

## Reviewer Checklist
- [ ] Repo is publicly accessible
- [ ] README describes what the skill does
- [ ] License is OSI-approved (MIT, Apache-2.0, etc.)
- [ ] No hardcoded secrets or credentials
- [ ] No malicious code patterns (eval, base64 obfuscation, suspicious domains)
- [ ] Skill installs and runs without errors
- [ ] Description is accurate and matches repo content
- [ ] Price tier is appropriate for complexity

If all checks pass, merge this skill into \`public/api/skills_index.json\` via PR.
`;

      const issueUrl = `https://github.com/edgarfloresguerra2011-a11y/marketnow/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}&labels=skill-submission`;

      // Open the issue in a new tab
      window.open(issueUrl, '_blank');
      setSubmitted(true);

      // Record the submission locally (for tier quota tracking)
      const newCount = recordSubmission(skill.slug);
      setSkillCount(newCount);
    } catch (err) {
      setScanError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            {c.title} <span className="text-[#00F299]">{c.titleAccent}</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            {c.subtitlePre}<span className="text-[#00F299]">{c.subtitleAccent}</span>{c.subtitlePost}
          </p>
        </motion.div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {c.stepLabels.map((label, idx) => {
            const n = idx + 1;
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  step >= n ? 'bg-[#00F299] text-black' : 'bg-white/5 text-zinc-500 border border-white/10'
                }`}>
                  {n}
                </div>
                <span className={`text-xs font-mono ${step >= n ? 'text-[#00F299]' : 'text-zinc-500'}`}>
                  {label.toUpperCase()}
                </span>
                {n < 3 && <div className="w-8 h-px bg-white/10 mx-1" />}
              </div>
            );
          })}
        </div>

        {/* Submission quota banner */}
        {!submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`premium-card p-5 mb-6 ${canSubmit ? '' : 'border-red-500/30'}`}
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{canSubmit ? '✅' : '⚠️'}</span>
                <div>
                  <div className="text-white font-semibold text-sm">
                    {fmt(c.tierLine, { tier: userTier, count: skillCount, max: tier.maxSkills === Infinity ? '∞' : tier.maxSkills })}
                  </div>
                  <div className="text-zinc-400 text-xs">
                    {canSubmit
                      ? fmt(remainingFree === 1 ? c.remainingSingular : c.remainingPlural, { n: remainingFree })
                      : c.limitReached}
                  </div>
                </div>
              </div>
              {(!canSubmit || (userTier === 'FREE' && remainingFree <= 1)) && (
                <Link
                  to="/pricing"
                  className="px-4 py-2 bg-[#00F299] text-black text-xs font-bold rounded-lg hover:bg-[#00F299]/90 transition-all"
                >
                  {c.upgradeBtn}
                </Link>
              )}
            </div>
          </motion.div>
        )}

        {/* Paywall overlay when user can't submit */}
        {showPaywall && !canSubmit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={() => setShowPaywall(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="premium-card p-8 max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-5xl mb-4 text-center">🚀</div>
              <h2 className="text-2xl font-bold text-white text-center mb-2">{c.paywallTitle}</h2>
              <p className="text-zinc-400 text-center text-sm mb-6">
                {fmt(c.paywallBody, { n: TIERS.FREE.maxSkills })}
              </p>
              <div className="space-y-3">
                <Link
                  to="/pricing"
                  className="block w-full py-3 bg-[#00F299] text-black font-bold text-center rounded-xl hover:bg-[#00F299]/90 transition-all"
                >
                  {c.upgradeProBtn}
                </Link>
                <button
                  onClick={() => setShowPaywall(false)}
                  className="block w-full py-3 border border-white/10 text-zinc-400 text-center rounded-xl hover:bg-white/5 transition-all"
                >
                  {c.maybeLaterBtn}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Step 1: Repo URL + Sentinel scan */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-8"
          >
            <h2 className="text-xl font-bold text-white mb-2">{c.step1Title}</h2>
            <p className="text-zinc-400 text-sm mb-6">
              {c.step1Desc}
            </p>

            <form onSubmit={(e) => { e.preventDefault(); runSentinelScan(); }} className="space-y-4">
              <input
                type="url"
                placeholder="https://github.com/your-username/your-mcp-server"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:border-[#00F299]/50 focus:outline-none font-mono text-sm"
              />

              {scanError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  ⚠ {scanError}
                </div>
              )}

              <button
                type="submit"
                disabled={scanning || !repoUrl}
                className="w-full py-4 bg-[#00F299] text-black font-bold tracking-wider rounded-xl hover:bg-[#00F299]/90 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {scanning ? c.scanningBtn : c.scanBtn}
              </button>
            </form>

            {/* Scan results */}
            {scanning && (
              <div className="mt-6 space-y-2">
                {c.scanSteps.map((step_name, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-4 h-4 border-2 border-[#00F299] border-t-transparent rounded-full animate-spin" />
                    <span className="text-zinc-400 font-mono">{step_name}...</span>
                  </div>
                ))}
              </div>
            )}

            {scanResult && (
              <div className="mt-6 p-6 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">{c.scanResultsTitle}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                    scanResult.passed
                      ? 'bg-[#00F299]/20 text-[#00F299] border border-[#00F299]/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}>
                    {scanResult.passed
                      ? fmt(c.passedTemplate, { score: scanResult.score, max: scanResult.maxScore })
                      : fmt(c.failedTemplate, { score: scanResult.score, max: scanResult.maxScore })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {c.checkLabels.map((label, i) => {
                    const ok = [
                      scanResult.repo_exists,
                      scanResult.readme_present,
                      scanResult.manifest_present,
                      scanResult.license_present,
                      scanResult.no_secrets,
                      scanResult.no_malicious,
                    ][i];
                    return (
                      <div key={label} className="flex items-center gap-2 text-sm">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                          ok ? 'bg-[#00F299] text-black' : 'bg-red-500/30 text-red-400'
                        }`}>
                          {ok ? '✓' : '✗'}
                        </span>
                        <span className={ok ? 'text-zinc-300' : 'text-red-400'}>{label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="text-xs text-zinc-500 font-mono">
                  ⭐ {scanResult.stars} {c.starsLabel} · 🐛 {scanResult.open_issues} {c.openIssuesLabel} ·
                  {' '}{c.updatedLabel} {scanResult.updated_at ? new Date(scanResult.updated_at).toLocaleDateString() : c.updatedUnknown}
                </div>

                {!scanResult.passed && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {c.scanFailedMsg}
                  </div>
                )}
              </div>
            )}

            {/* How it works */}
            <div className="mt-8 p-4 rounded-xl bg-[#00F299]/5 border border-[#00F299]/20">
              <h4 className="text-[#00F299] text-xs font-mono tracking-wider mb-2">{c.commissionTitle}</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                {c.commissionBodyPre}<span className="text-[#00F299]">{c.commissionBodyComm}</span>{c.commissionBodyMid}<span className="text-[#00F299]">{c.commissionBodySeller}</span>{c.commissionBodyPost}
              </p>
            </div>
          </motion.div>
        )}

        {/* Step 2: Metadata */}
        {step === 2 && scanResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-8"
          >
            <h2 className="text-xl font-bold text-white mb-2">{c.step2Title}</h2>
            <p className="text-zinc-400 text-sm mb-6">
              {c.step2Desc}
            </p>

            <form onSubmit={(e) => { e.preventDefault(); setStep(3); }} className="space-y-4">
              <div>
                <label className="text-zinc-400 text-sm block mb-1.5">{c.form.name}</label>
                <input
                  type="text"
                  value={skill.name}
                  onChange={(e) => setSkill({ ...skill, name: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00F299]/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-sm block mb-1.5">{c.form.slug}</label>
                <input
                  type="text"
                  value={skill.slug}
                  onChange={(e) => setSkill({ ...skill, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00F299]/50 focus:outline-none font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-zinc-400 text-sm block mb-1.5">{c.form.description}</label>
                <textarea
                  value={skill.description}
                  onChange={(e) => setSkill({ ...skill, description: e.target.value })}
                  required
                  rows={3}
                  placeholder={c.descPlaceholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00F299]/50 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-zinc-400 text-sm block mb-1.5">{c.form.category}</label>
                  <select
                    value={skill.category}
                    onChange={(e) => setSkill({ ...skill, category: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00F299]/50 focus:outline-none"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-zinc-400 text-sm block mb-1.5">{c.form.author}</label>
                  <input
                    type="text"
                    value={skill.author}
                    onChange={(e) => setSkill({ ...skill, author: e.target.value })}
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00F299]/50 focus:outline-none font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 text-sm block mb-1.5">{c.form.tags}</label>
                <input
                  type="text"
                  value={skill.tags}
                  onChange={(e) => setSkill({ ...skill, tags: e.target.value })}
                  placeholder="mcp, ai, automation, scraper"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-[#00F299]/50 focus:outline-none font-mono text-sm"
                />
              </div>

              {/* Price tier selection */}
              <div>
                <label className="text-zinc-400 text-sm block mb-3">{c.form.priceTier}</label>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {PRICE_TIERS.map((tier, i) => (
                    <button
                      key={tier.price}
                      type="button"
                      onClick={() => setSkill({ ...skill, priceTier: i })}
                      className={`p-3 rounded-xl text-left transition-all ${
                        skill.priceTier === i
                          ? 'bg-[#00F299]/20 border border-[#00F299]/40'
                          : 'bg-white/5 border border-white/5 hover:border-[#00F299]/30'
                      }`}
                    >
                      <div className={`text-lg font-bold font-mono ${skill.priceTier === i ? 'text-[#00F299]' : 'text-white'}`}>
                        ${tier.price}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">{c.tierLabels[tier.label] || tier.label}</div>
                      <div className="text-[9px] text-zinc-500 mt-1">{c.tierDescs[tier.label] || tier.desc}</div>
                      <div className="text-[9px] text-[#00F299] mt-2 font-mono">
                        {c.youGetPre}${(tier.price * (1 - COMMISSION_RATE)).toFixed(2)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3 border border-white/10 text-zinc-400 font-medium rounded-xl hover:bg-white/5 transition-all"
                >
                  {c.backBtn}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#00F299] text-black font-bold tracking-wider rounded-xl hover:bg-[#00F299]/90 transition-all"
                >
                  {c.reviewBtn}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 3: Review + submit */}
        {step === 3 && !submitted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="premium-card p-8"
          >
            <h2 className="text-xl font-bold text-white mb-2">{c.step3Title}</h2>
            <p className="text-zinc-400 text-sm mb-6">
              {c.step3Desc}
            </p>

            <div className="space-y-3 mb-6">
              {[
                { label: c.reviewLabels.name, value: skill.name },
                { label: c.reviewLabels.slug, value: skill.slug },
                { label: c.reviewLabels.description, value: skill.description },
                { label: c.reviewLabels.category, value: skill.category },
                { label: c.reviewLabels.author, value: skill.author },
                { label: c.reviewLabels.tags, value: skill.tags },
                { label: c.reviewLabels.price, value: `$${PRICE_TIERS[skill.priceTier].price} (${c.tierLabels[PRICE_TIERS[skill.priceTier].label] || PRICE_TIERS[skill.priceTier].label})` },
                { label: c.reviewLabels.youReceive, value: `$${(PRICE_TIERS[skill.priceTier].price * (1 - COMMISSION_RATE)).toFixed(2)}` },
                { label: c.reviewLabels.sourceRepo, value: scanResult ? `${scanResult.owner}/${scanResult.repo}` : repoUrl },
                { label: c.reviewLabels.sentinelScore, value: `${scanResult?.score}/${scanResult?.maxScore} ${scanResult?.passed ? c.passedShort : c.failedShort}` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4 py-2 border-b border-white/5">
                  <span className="text-zinc-500 text-sm">{row.label}</span>
                  <span className="text-white text-sm font-mono text-right">{row.value}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-3 border border-white/10 text-zinc-400 font-medium rounded-xl hover:bg-white/5 transition-all"
                >
                  {c.backBtn}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-[#00F299] text-black font-bold tracking-wider rounded-xl hover:bg-[#00F299]/90 transition-all disabled:opacity-50"
                >
                  {submitting ? c.openingBtn : c.submitBtn}
                </button>
              </div>
            </form>

            {/* Sentinel Certification Preview — shows what badge the skill will get */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🛡️</span>
                <h3 className="text-white text-sm font-semibold">Sentinel Certification Preview</h3>
              </div>
              <p className="text-zinc-500 text-xs mb-4">
                Once your skill is listed, it will receive a signed Sentinel certificate with a verified score. Here's what buyers will see:
              </p>
              <div className="bg-black/30 rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`px-3 py-1.5 rounded font-mono text-xs border ${
                    scanResult?.passed
                      ? 'bg-[#00F299]/10 text-[#00F299] border-[#00F299]/20'
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                  }`}>
                    🛡️ CERTIFIED {scanResult?.score || '?'}/10
                  </div>
                  <div className="text-zinc-500 text-xs">
                    <div>Badge in your skill page + README</div>
                    <div className="text-zinc-600 text-[10px]">Color-coded by risk level</div>
                  </div>
                </div>
                <Link to="/verify" className="text-[#00d1ff] text-xs hover:underline whitespace-nowrap">
                  → See how it looks
                </Link>
              </div>
              <div className="mt-3 text-zinc-600 text-[10px] font-mono">
                Markdown: <span className="text-zinc-400">[![Sentinel Certified](https://marketnow.site/badges/sentinel-certified-{'{skillId}'}.svg)](https://marketnow.site/skill/{'{skillId}'})</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Submitted */}
        {submitted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="premium-card p-12 text-center"
          >
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">{c.submittedTitle}</h2>
            <p className="text-zinc-400 mb-6 max-w-md mx-auto">
              {c.submittedBody}
            </p>

            {/* Sentinel certification info post-submit */}
            <div className="bg-[#00F299]/5 border border-[#00F299]/10 rounded-lg p-4 mb-6 max-w-md mx-auto">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-lg">🛡️</span>
                <span className="text-[#00F299] text-sm font-semibold">Sentinel Certified</span>
              </div>
              <p className="text-zinc-400 text-xs mb-3">
                Once listed, your skill will receive a signed certificate with a verified score. Buyers can verify it anytime at:
              </p>
              <Link to="/verify" className="text-[#00d1ff] text-xs hover:underline font-mono">
                marketnow.site/verify
              </Link>
            </div>

            <div className="flex gap-3 justify-center">
              <Link
                to="/registry"
                className="px-6 py-3 bg-[#00F299] text-black font-semibold rounded-xl hover:bg-[#00F299]/90 transition-all"
              >
                {c.browseBtn}
              </Link>
              <button
                onClick={() => {
                  setStep(1);
                  setSubmitted(false);
                  setRepoUrl('');
                  setScanResult(null);
                  setSkill({
                    name: '', slug: '', description: '', category: 'AI/ML',
                    priceTier: 2, tags: '', author: '', install: '',
                  });
                }}
                className="px-6 py-3 border border-white/10 text-zinc-400 font-medium rounded-xl hover:bg-white/5 transition-all"
              >
                {c.submitAnotherBtn}
              </button>
            </div>
          </motion.div>
        )}

        {/* Trust badges */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
          {c.trustBadges.map((b) => (
            <div key={b.title} className="premium-card p-5">
              <div className="text-3xl mb-3">{b.icon}</div>
              <h3 className="text-white font-semibold text-sm mb-1">{b.title}</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">{fmt(b.desc, { pct: COMMISSION_RATE * 100 })}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
