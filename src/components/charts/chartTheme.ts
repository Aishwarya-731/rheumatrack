import { useThemeColors } from '@/app/providers/ThemeProvider';

const NAMES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-grid', 'chart-axis', 'text', 'text-muted', 'surface', 'border-strong', 'accent', 'warning'] as const;

export function useChartTheme() {
  const c = useThemeColors(NAMES);
  return {
    series: [c['chart-1'], c['chart-2'], c['chart-3'], c['chart-4'], c['chart-5']],
    grid: c['chart-grid'],
    axis: c['chart-axis'],
    text: c.text,
    muted: c['text-muted'],
    surface: c.surface,
    border: c['border-strong'],
    accent: c.accent,
    warning: c.warning,
    tick: { fill: c['chart-axis'], fontSize: 12 },
  };
}

export type ChartTheme = ReturnType<typeof useChartTheme>;
