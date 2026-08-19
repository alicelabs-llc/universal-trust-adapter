/**
 * LanguageNotice — muestra un aviso cuando el usuario tiene ES seleccionado
 * pero la página actual no está traducida.
 *
 * Se renderiza solo si lang === 'es' y la página no está en la lista de traducidas.
 */
import { useLocation } from 'react-router-dom';
import { useLang } from '../context/LanguageContext.jsx';

// Páginas que SÍ están traducidas (no muestran el aviso)
const TRANSLATED_PAGES = ['/', '/registry', '/pricing'];

export default function LanguageNotice() {
  const { lang, t, toggleLang } = useLang();
  const location = useLocation();

  if (lang !== 'es') return null;
  if (TRANSLATED_PAGES.some(p => location.pathname === p)) return null;

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center">
      <p className="text-amber-300 text-xs font-mono">
        🌐 {t('lang.notice')}{' '}
        <button
          onClick={toggleLang}
          className="underline hover:text-amber-200 transition-colors"
        >
          → English
        </button>
      </p>
    </div>
  );
}
