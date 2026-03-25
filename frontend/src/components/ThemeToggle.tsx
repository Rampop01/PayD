import { Icon } from '@stellar/design-system';
import { useTheme } from '../providers/ThemeProvider';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg glass border-hi hover:bg-white/5 transition-all outline-none flex items-center justify-center text-text"
      title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
    >
      {theme === 'light' ? <Icon.Moon01 size="md" /> : <Icon.Sun size="md" />}
    </button>
  );
};
