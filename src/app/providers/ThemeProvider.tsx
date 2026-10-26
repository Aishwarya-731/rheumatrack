import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'rt.theme';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Initial theme: the value the inline script in index.html already applied, else stored/OS. */
export function initialTheme(): Theme {
  const applied = document.documentElement.dataset.theme;
  if (applied === 'light' || applied === 'dark') return applied;
  return readStored() ?? systemTheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#090b0b' : '#eef2f3');
  }, [theme]);

  // Follow OS changes only while the user has not chosen a theme explicitly.
  useEffect(() => {
    let mql: MediaQueryList;
    try {
      mql = window.matchMedia('(prefers-color-scheme: light)');
    } catch {
      return;
    }
    const onChange = () => {
      if (readStored() === null) setThemeState(mql.matches ? 'light' : 'dark');
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Resolves CSS custom properties to concrete colours (for charts and WebGL). Recomputed on theme change. */
export function useThemeColors<K extends string>(names: readonly K[]): Record<K, string> {
  const { theme } = useTheme();
  const key = names.join('|');
  return useMemo(() => {
    const style = getComputedStyle(document.documentElement);
    const out = {} as Record<K, string>;
    for (const n of names) out[n] = style.getPropertyValue(`--${n}`).trim() || '#888888';
    return out;
  }, [theme, key]);
}
