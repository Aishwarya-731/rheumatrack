import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      data-testid="theme-toggle"
    >
      {theme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </button>
  );
}
