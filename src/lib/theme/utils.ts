import { themes } from './index';
import type { ThemeName } from './index';

export function applyTheme(themeName: ThemeName) {
  const theme = themes[themeName];
  const root = document.documentElement;
  
  // Apply theme colors as CSS custom properties
  Object.entries(theme).forEach(([key, value]) => {
    // Convert camelCase to kebab-case
    const cssProperty = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    root.style.setProperty(cssProperty, value);
  });
}