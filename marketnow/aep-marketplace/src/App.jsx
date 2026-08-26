import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, Component } from 'react';

// Error Boundary — catches any render crash and shows a message instead of black screen
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Page crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="premium-card p-8 max-w-lg text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-zinc-400 text-sm mb-4">
              This page crashed. Try refreshing, or go back to the home page.
            </p>
            <p className="text-zinc-600 text-xs font-mono mb-6 break-all">
              {this.state.error?.message || 'Unknown error'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-[#00F299] text-black font-bold rounded-lg hover:bg-[#00F299]/90 text-sm"
              >
                REFRESH
              </button>
              <a
                href="/"
                className="px-5 py-2.5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/5 text-sm"
              >
                HOME
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Components
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import BackgroundOrbs from './components/BackgroundOrbs';
import AuthModal from './components/AuthModal';
import { setAuth, getUser } from './api/client';
import { captureAffiliateRef } from './utils/affiliate';

// Pages
import Registry from './pages/Registry';
import SkillDetail from './pages/SkillDetail';
import Vault from './pages/Vault';
import Governance from './pages/Governance';
import Security from './pages/Security';
import Handshake from './pages/Handshake';
import Policies from './pages/Policies';
import Submit from './pages/Submit';
import Dashboard from './pages/Dashboard';
import Pricing from './pages/Pricing';
import AgentLanding from "./pages/AgentLanding";
import Mandates from "./pages/Mandates";
import Trust from "./pages/Trust";
import About from "./pages/About";
import Catalog from "./pages/Catalog";
import Embed from "./pages/Embed";
import Standards from "./pages/Standards";
import Listings from "./pages/Listings";
import Blog from "./pages/Blog";
import Compare from "./pages/Compare";
import BuyersGuide from "./pages/BuyersGuide";
import Onboarding from "./pages/Onboarding";
import SentinelRoadmap from "./pages/SentinelRoadmap";
import VerifyCertificate from "./pages/VerifyCertificate";
import SentinelTransparency from "./pages/SentinelTransparency";

function App() {
  const [authOpen, setAuthOpen] = useState(false);

  // Capture affiliate ref from URL on first load
  useEffect(() => {
    captureAffiliateRef();
  }, []);

  // GitHub Pages SPA fallback:
  // When a user hits /registry directly, GitHub Pages serves 404.html
  // which redirects to /?p=/registry. We need to convert that back to
  // the real path so React Router can handle it.
  // SECURITY: strict validation — only allow relative paths starting with '/'
  // and NOT starting with '//', '/\', or protocol-relative URLs. Prevents
  // open-redirect phishing via ?p=//evil.com
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('p');
    if (p) {
      // Strict allowlist of known internal routes
      const ALLOWED_ROUTES = [
        '/registry', '/vault', '/governance', '/security',
        '/handshake', '/policies', '/submit', '/pricing', '/dashboard', '/mandates',
        '/trust', '/about', '/catalog', '/embed', '/standards', '/listings',
        '/blog', '/compare', '/buyers-guide', '/onboarding', '/sentinel-roadmap',
        '/verify', '/sentinel-transparency',
      ];
      // Allow /skill/:id pattern (starts with /skill/)
      const isSkillRoute = p.startsWith('/skill/') && p.length > 7 && p.length < 100;
      const isAllowedRoute = ALLOWED_ROUTES.includes(p);

      if (isAllowedRoute || isSkillRoute) {
        params.delete('p');
        const remaining = params.toString();
        const newUrl = p + (remaining ? '?' + remaining : '');
        window.history.replaceState({}, '', newUrl);
      } else {
        // Reject anything else — redirect to home
        console.warn('Rejected suspicious ?p= parameter:', p);
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  // Check URL params for login trigger
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('login') === 'true') {
      setAuthOpen(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleAuthSuccess = () => {
    window.dispatchEvent(new Event('auth-change'));
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-black text-white overflow-x-hidden">
        <BackgroundOrbs />
        <Navbar />

        <ErrorBoundary>
        <Routes>
          <Route path="/" element={<AgentLanding />} />
          <Route path="/uta" element={<UTA />} />
          <Route path="/skills" element={<Navigate to="/registry" replace />} />
          <Route path="/registry" element={<Registry />} />
          <Route path="/skill/:id" element={<SkillDetail />} />
          <Route path="/vault" element={<Vault />} />
          <Route path="/governance" element={<Governance />} />
          <Route path="/security" element={<Security />} />
          <Route path="/handshake" element={<Handshake />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/agents" element={<AgentLanding />} />
          <Route path="/mandates" element={<Mandates />} />
          <Route path="/trust" element={<Trust />} />
          <Route path="/about" element={<About />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/embed" element={<Embed />} />
          <Route path="/standards" element={<Standards />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/buyers-guide" element={<BuyersGuide />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/sentinel-roadmap" element={<SentinelRoadmap />} />
          <Route path="/verify" element={<VerifyCertificate />} />
          <Route path="/sentinel-transparency" element={<SentinelTransparency />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* /dashboard is now publicly accessible */}
        </Routes>
        </ErrorBoundary>

        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          onAuthSuccess={handleAuthSuccess}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;

