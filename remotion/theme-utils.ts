import type { Theme } from '../src/style/theme';

/** Layer-level overrides (written by the editor after a manual edit) win over the style theme. */
export function applyOverride(theme: Theme, override?: Record<string, unknown>): Theme {
  if (!override) return theme;
  return { ...theme, ...override, colors: { ...theme.colors, ...((override.colors as Record<string, string>) ?? {}) } } as Theme;
}
