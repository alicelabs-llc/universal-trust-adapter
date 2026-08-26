import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { isAuthenticated, getUser, logout } from '../api/client';
import { useLang } from '../context/LanguageContext.jsx';
import AuthModal from './AuthModal';

// Grouped nav structure — labels come from i18n t() at render time
const NAV_GROUPS = [
  {
    labelKey: 'nav.marketplace',
    items: [
      { path: '/registry', labelKey: 'nav.browse' },
      { path: '/submit', labelKey: 'nav.publish' },
      { path: '/pricing', labelKey: 'nav.pricing' },
    ],
  },
  {
    labelKey: 'nav.trust',
    items: [
      { path: '/uta', labelKey: 'nav.uta' },
      { path: '/trust', labelKey: 'nav.trustRoadmap' },
      { path: '/standards', labelKey: 'nav.standards' },
      { path: '/security', labelKey: 'nav.sentinel' },
      { path: '/compare', labelKey: 'nav.compare' },
      { path: '/listings', labelKey: 'nav.listings' },
    ],
  },
  {
    labelKey: 'nav.resources',
    items: [
      { path: '/blog', labelKey: 'nav.blog' },
      { path: '/buyers-guide', labelKey: 'nav.buyersGuide' },
      { path: '/onboarding', labelKey: 'nav.onboarding' },
      { path: '/catalog', labelKey: 'nav.catalog' },
      { path: '/embed', labelKey: 'nav.badges' },
      { path: '/handshake', labelKey: 'nav.apiDocs' },
      { path: '/policies', labelKey: 'nav.terms' },
    ],
  },
  {
    labelKey: 'nav.account',
    items: [
      { path: '/mandates', labelKey: 'nav.mandates' },
      { path: '/vault', labelKey: 'nav.vault' },
      { path: '/dashboard', labelKey: 'nav.dashboard' },
      { path: '/about', labelKey: 'nav.about' },
    ],
  },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang, t, changeLang, languages } = useLang();
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [openGroup, setOpenGroup] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const dropdownRef = useRef(null);
  const langRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated()) {
      setUser(getUser());
    }
    const handler = () => {
      if (isAuthenticated()) {
        setUser(getUser());
      } else {
        setUser(null);
      }
    };
    window.addEventListener('auth-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('auth-change', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenGroup(null);
      }
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [location.pathname]);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    window.dispatchEvent(new Event('auth-change'));
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    window.dispatchEvent(new Event('auth-change'));
  };

  const goHome = () => {
    navigate('/');
  };

  const isActive = (path) => {
    if (path === '/registry' && location.pathname.startsWith('/skill')) return true;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const isGroupActive = (group) => {
    return group.items.some(item => isActive(item.path));
  };

  return (
    <>
      <nav className="sticky top-0 z-[1000] glass-panel border-b border-white/5">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Logo + name — click navigates home */}
          <button
            type="button"
            onClick={goHome}
            className="flex items-center gap-2 shrink-0 cursor-pointer group focus:outline-none"
            title={t('nav.goHome')}
            aria-label={t('nav.goHome')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00F299] to-[#00d1ff] flex items-center justify-center text-black font-bold text-lg select-none group-hover:scale-105 transition-transform">
              M
            </div>
            <span className="text-white font-bold text-sm tracking-tight hidden sm:block">
              MARKET<span className="text-[#00F299]">NOW</span>
            </span>
          </button>

          {/* Desktop nav with dropdowns */}
          <div className="hidden lg:flex items-center gap-1" ref={dropdownRef}>
            {NAV_GROUPS.map((group) => (
              <div
                key={group.labelKey}
                className="relative"
                onMouseEnter={() => setOpenGroup(group.labelKey)}
                onMouseLeave={() => setOpenGroup(null)}
              >
                <button
                  onClick={() => setOpenGroup(openGroup === group.labelKey ? null : group.labelKey)}
                  className={`px-3 py-2 text-xs font-mono tracking-wider transition-colors rounded-lg flex items-center gap-1 ${
                    isGroupActive(group) || openGroup === group.labelKey
                      ? 'text-[#00F299] bg-[#00F299]/5'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {t(group.labelKey)}
                  <span className={`text-[8px] transition-transform ${openGroup === group.labelKey ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {openGroup === group.labelKey && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 pt-1 min-w-[200px] z-50"
                  >
                    <div className="bg-black/95 border border-white/10 rounded-xl shadow-2xl py-2 backdrop-blur-xl">
                      {group.items.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setOpenGroup(null)}
                          className={`block px-4 py-2 text-xs transition-colors ${
                            isActive(item.path)
                              ? 'text-[#00F299] bg-[#00F299]/5'
                              : 'text-zinc-400 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          {t(item.labelKey)}
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Auth + Language section */}
          <div className="flex items-center gap-2">
            {/* Language dropdown — 5 languages */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-white/10 text-xs font-mono hover:border-[#00F299]/40 hover:bg-white/5 transition-all"
                title={t('nav.language')}
                aria-label={t('nav.language')}
              >
                <span className="text-sm">{languages.find(l => l.code === lang)?.flag}</span>
                <span className="text-[#00F299]">{languages.find(l => l.code === lang)?.label}</span>
                <span className={`text-[8px] text-zinc-500 transition-transform ${langOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full right-0 mt-1 min-w-[140px] bg-black/95 border border-white/10 rounded-xl shadow-2xl py-1 backdrop-blur-xl z-50"
                >
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => {
                        changeLang(l.code);
                        setLangOpen(false);
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                        lang === l.code
                          ? 'text-[#00F299] bg-[#00F299]/5'
                          : 'text-zinc-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="text-sm">{l.flag}</span>
                      <span>{l.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </div>

            {user ? (
              <>
                <span className="text-[#00F299] text-xs font-mono hidden sm:block">
                  {user.username}
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all"
                >
                  {t('nav.signOut')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="px-4 py-1.5 text-xs font-bold bg-[#00F299] text-black rounded-lg hover:bg-[#00F299]/90 transition-all"
              >
                {t('nav.signIn')}
              </button>
            )}

            <Link
              to="/handshake"
              className="hidden md:flex items-center gap-2 px-4 py-1.5 border border-[#00F299]/30 rounded-full text-xs font-mono tracking-wider text-[#00F299] hover:bg-[#00F299]/10 hover:border-[#00F299]/50 transition-all duration-300"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#00F299] animate-pulse" />
              {t('nav.api')}
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-white"
              aria-label={t('nav.toggleMenu')}
            >
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="lg:hidden border-t border-white/5 bg-black/95 max-h-[80vh] overflow-y-auto"
          >
            <div className="px-4 py-4 space-y-4">
              {NAV_GROUPS.map((group) => (
                <div key={group.labelKey}>
                  <div className="text-zinc-600 text-[10px] font-mono tracking-wider mb-2">{t(group.labelKey)}</div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`block px-3 py-2 text-sm rounded-lg ${
                          isActive(item.path)
                            ? 'text-[#00F299] bg-[#00F299]/5'
                            : 'text-zinc-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {t(item.labelKey)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </nav>

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}
