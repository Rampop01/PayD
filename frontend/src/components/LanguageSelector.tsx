import { useTranslation } from 'react-i18next';
import { Icon } from '@stellar/design-system';

export const LanguageSelector = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'en' ? 'es' : 'en';
    void i18n.changeLanguage(nextLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="px-3 py-2 rounded-lg glass border-hi hover:bg-white/5 transition-all outline-none flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-text"
      title={i18n.language === 'en' ? 'Cambiar a Español' : 'Switch to English'}
    >
      <Icon.Globe01 size="sm" />
      <span>{i18n.language === 'en' ? 'EN' : 'ES'}</span>
    </button>
  );
};
