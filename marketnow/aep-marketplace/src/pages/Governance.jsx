import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../context/LanguageContext.jsx';
import { isAuthenticated } from '../api/client';

/**
 * MarketNow — Community & Roadmap (static version)
 *
 * GitHub Pages no tiene backend, así que las proposals se cargan desde
 * un archivo estático /api/proposals.json. Los votos se guardan en localStorage.
 */

// Static proposals — titles kept as English literal content (factual),
// status values used internally for color logic; display is translated
// via CONTENT[lang].statuses.
const STATIC_PROPOSALS = [
  { id: 'MN-001', title: 'Add free tier for open-source contributors', status: 'Active', votes: 142, deadline: '6d 12h' },
  { id: 'MN-002', title: 'UTA v1.0.0: gVisor sandbox execution checks', status: 'Active', votes: 89, deadline: '9d 4h' },
  { id: 'MN-003', title: 'Public status page with real uptime metrics', status: 'Active', votes: 67, deadline: '12d 18h' },
  { id: 'MN-004', title: 'Skill bundles: buy 3+ for 15% discount', status: 'Passed', votes: 312, deadline: 'Completed' },
  { id: 'MN-005', title: 'Open reviews: signed-in users can rate skills', status: 'Passed', votes: 245, deadline: 'Completed' },
  { id: 'MN-006', title: 'Deprecate the credits system in favor of free install for buyerss', status: 'Passed', votes: 421, deadline: 'Completed' },
];

// ═══════════════════════════════════════════════════════════════════════════
// CONTENT — all visible UI strings in 5 languages
// ═══════════════════════════════════════════════════════════════════════════
const CONTENT = {
  en: {
    title: 'COMMUNITY',
    titleAccent: 'PROPOSALS',
    subtitle: 'Vote on upcoming features and policy changes for the MarketNow marketplace. Every signed-in user can vote once per proposal — no tokens or staking required.',
    stepPrefix: 'STEP',
    steps: [
      { step: '1', title: 'Sign in', desc: 'Create a free MarketNow account to participate.' },
      { step: '2', title: 'Read proposals', desc: 'Review active proposals and their expected impact.' },
      { step: '3', title: 'Vote', desc: 'Cast a single vote per proposal. Results are public.' },
    ],
    msgSignIn: 'Sign in to vote on proposals',
    msgAlreadyVoted: 'You already voted on this proposal',
    msgVoteCast: 'Vote cast! Thank you for participating.',
    loading: 'Loading proposals...',
    emptyTitle: 'No Active Proposals',
    emptyDesc: 'Check back soon — new proposals are posted regularly.',
    votesSuffix: 'votes',
    remainingSuffix: 'remaining',
    votedBtn: '✓ VOTED',
    voteBtn: 'VOTE',
    votingBtn: '...',
    statuses: {
      Active: 'Active',
      Passed: 'Passed',
      Rejected: 'Rejected',
    },
  },
  es: {
    title: 'PROPUESTAS',
    titleAccent: 'DE LA COMUNIDAD',
    subtitle: 'Vota por las próximas features y cambios de política del marketplace de MarketNow. Cada usuario con sesión iniciada puede votar una vez por propuesta — sin tokens ni staking.',
    stepPrefix: 'PASO',
    steps: [
      { step: '1', title: 'Inicia sesión', desc: 'Crea una cuenta gratuita de MarketNow para participar.' },
      { step: '2', title: 'Lee las propuestas', desc: 'Revisa las propuestas activas y su impacto esperado.' },
      { step: '3', title: 'Vota', desc: 'Emite un solo voto por propuesta. Los resultados son públicos.' },
    ],
    msgSignIn: 'Inicia sesión para votar en las propuestas',
    msgAlreadyVoted: 'Ya votaste en esta propuesta',
    msgVoteCast: '¡Voto registrado! Gracias por participar.',
    loading: 'Cargando propuestas...',
    emptyTitle: 'No Hay Propuestas Activas',
    emptyDesc: 'Vuelve pronto — se publican nuevas propuestas regularmente.',
    votesSuffix: 'votos',
    remainingSuffix: 'restante',
    votedBtn: '✓ VOTADO',
    voteBtn: 'VOTAR',
    votingBtn: '...',
    statuses: {
      Active: 'Activa',
      Passed: 'Aprobada',
      Rejected: 'Rechazada',
    },
  },
  pt: {
    title: 'PROPOSTAS',
    titleAccent: 'DA COMUNIDADE',
    subtitle: 'Vote nas próximas features e mudanças de política do marketplace do MarketNow. Todo usuário logado pode votar uma vez por proposta — sem tokens nem staking.',
    stepPrefix: 'PASSO',
    steps: [
      { step: '1', title: 'Entre na conta', desc: 'Crie uma conta gratuita no MarketNow para participar.' },
      { step: '2', title: 'Leia as propostas', desc: 'Revise as propostas ativas e seu impacto esperado.' },
      { step: '3', title: 'Vote', desc: 'Dê um único voto por proposta. Os resultados são públicos.' },
    ],
    msgSignIn: 'Entre na conta para votar nas propostas',
    msgAlreadyVoted: 'Você já votou nesta proposta',
    msgVoteCast: 'Voto registrado! Obrigado por participar.',
    loading: 'Carregando propostas...',
    emptyTitle: 'Nenhuma Proposta Ativa',
    emptyDesc: 'Volte em breve — novas propostas são publicadas regularmente.',
    votesSuffix: 'votos',
    remainingSuffix: 'restante',
    votedBtn: '✓ VOTADO',
    voteBtn: 'VOTAR',
    votingBtn: '...',
    statuses: {
      Active: 'Ativa',
      Passed: 'Aprovada',
      Rejected: 'Rejeitada',
    },
  },
  zh: {
    title: '社区',
    titleAccent: '提案',
    subtitle: '为 MarketNow marketplace 即将推出的功能和政策变更投票。每位已登录的用户可以对每个提案投一次票 —— 无需代币或质押。',
    stepPrefix: '第',
    steps: [
      { step: '1', title: '登录', desc: '创建免费的 MarketNow 账户即可参与。' },
      { step: '2', title: '阅读提案', desc: '审阅活跃提案及其预期影响。' },
      { step: '3', title: '投票', desc: '每个提案投一票。结果公开。' },
    ],
    msgSignIn: '登录后可对提案投票',
    msgAlreadyVoted: '你已经对此提案投过票了',
    msgVoteCast: '投票成功！感谢参与。',
    loading: '正在加载提案...',
    emptyTitle: '暂无活跃提案',
    emptyDesc: '敬请关注 —— 新提案会定期发布。',
    votesSuffix: '票',
    remainingSuffix: '剩余',
    votedBtn: '✓ 已投票',
    voteBtn: '投票',
    votingBtn: '...',
    statuses: {
      Active: '进行中',
      Passed: '已通过',
      Rejected: '已否决',
    },
  },
  fr: {
    title: 'PROPOSITIONS',
    titleAccent: 'COMMUNAUTAIRES',
    subtitle: 'Votez pour les prochaines fonctionnalités et changements de politique du marketplace MarketNow. Chaque utilisateur connecté peut voter une fois par proposition — sans jetons ni staking.',
    stepPrefix: 'ÉTAPE',
    steps: [
      { step: '1', title: 'Connectez-vous', desc: 'Créez un compte MarketNow gratuit pour participer.' },
      { step: '2', title: 'Lisez les propositions', desc: 'Examinez les propositions actives et leur impact attendu.' },
      { step: '3', title: 'Votez', desc: 'Donnez un seul vote par proposition. Les résultats sont publics.' },
    ],
    msgSignIn: 'Connectez-vous pour voter sur les propositions',
    msgAlreadyVoted: 'Vous avez déjà voté pour cette proposition',
    msgVoteCast: 'Vote enregistré ! Merci de votre participation.',
    loading: 'Chargement des propositions...',
    emptyTitle: 'Aucune Proposition Active',
    emptyDesc: 'Revenez bientôt — de nouvelles propositions sont publiées régulièrement.',
    votesSuffix: 'votes',
    remainingSuffix: 'restant',
    votedBtn: '✓ VOTÉ',
    voteBtn: 'VOTER',
    votingBtn: '...',
    statuses: {
      Active: 'Active',
      Passed: 'Adoptée',
      Rejected: 'Rejetée',
    },
  },
};

export default function Governance() {
  const { lang } = useLang();
  const c = CONTENT[lang] || CONTENT.en;

  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(null);
  const [message, setMessage] = useState('');
  const [votedIds, setVotedIds] = useState(() => {
    try {
      const raw = localStorage.getItem('mn_votes');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  useEffect(() => {
    // Simulate load delay for UX consistency
    const t = setTimeout(() => {
      setProposals(STATIC_PROPOSALS);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const handleVote = (proposalId) => {
    if (!isAuthenticated()) {
      setMessage(c.msgSignIn);
      return;
    }
    if (votedIds.includes(proposalId)) {
      setMessage(c.msgAlreadyVoted);
      return;
    }
    setVoting(proposalId);
    setTimeout(() => {
      setProposals(prev => prev.map(p =>
        p.id === proposalId ? { ...p, votes: p.votes + 1 } : p
      ));
      const newVoted = [...votedIds, proposalId];
      setVotedIds(newVoted);
      localStorage.setItem('mn_votes', JSON.stringify(newVoted));
      setMessage(c.msgVoteCast);
      setVoting(null);
    }, 500);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Active': return 'text-[#00F299] border-[#00F299]/30 bg-[#00F299]/5';
      case 'Passed': return 'text-green-400 border-green-400/30 bg-green-400/5';
      case 'Rejected': return 'text-red-400 border-red-400/30 bg-red-400/5';
      default: return 'text-zinc-400 border-zinc-400/30 bg-zinc-400/5';
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-[1440px] mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            {c.title} <span className="text-[#00F299]">{c.titleAccent}</span>
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            {c.subtitle}
          </p>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10"
        >
          {c.steps.map((s) => (
            <div key={s.step} className="premium-card p-5">
              <div className="text-[#00F299] font-mono text-xs mb-2">{c.stepPrefix} {s.step}</div>
              <div className="text-white font-semibold mb-1">{s.title}</div>
              <div className="text-zinc-400 text-sm">{s.desc}</div>
            </div>
          ))}
        </motion.div>

        {message && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-[#00F299]/10 border border-[#00F299]/20 text-[#00F299] text-sm text-center">
            {message}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-[#00F299] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-zinc-500 font-mono text-sm">{c.loading}</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="premium-card p-12 text-center">
            <div className="text-5xl mb-4">🗳️</div>
            <h2 className="text-xl font-semibold text-white mb-2">{c.emptyTitle}</h2>
            <p className="text-zinc-400">{c.emptyDesc}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {proposals.map((proposal, i) => (
              <motion.div
                key={proposal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="premium-card p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[#00F299] font-mono text-xs font-bold">{proposal.id}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border ${getStatusColor(proposal.status)}`}>
                        {c.statuses[proposal.status] || proposal.status}
                      </span>
                    </div>
                    <h3 className="text-white font-semibold mb-2">{proposal.title}</h3>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono">
                      <span>{proposal.votes.toLocaleString()} {c.votesSuffix}</span>
                      {proposal.deadline !== 'Completed' && (
                        <span>{proposal.deadline} {c.remainingSuffix}</span>
                      )}
                    </div>
                  </div>

                  {proposal.status === 'Active' && (
                    votedIds.includes(proposal.id) ? (
                      <span className="px-6 py-2.5 bg-white/5 border border-[#00F299]/30 text-[#00F299] text-[11px] font-bold tracking-wider rounded-xl">
                        {c.votedBtn}
                      </span>
                    ) : (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleVote(proposal.id)}
                        disabled={voting === proposal.id}
                        className="px-6 py-2.5 bg-[#00F299] text-[11px] text-black font-bold tracking-wider rounded-xl hover:bg-[#00F299]/90 transition-all disabled:opacity-50"
                      >
                        {voting === proposal.id ? c.votingBtn : c.voteBtn}
                      </motion.button>
                    )
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
